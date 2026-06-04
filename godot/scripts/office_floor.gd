extends Node3D
## Root controller for the office floor: real-time day cycle, screenshot
## automation (--shot) and wallpaper mode (--wallpaper).

## hour → [sun pitch°, sun energy, sun color, sky color, ambient energy].
## Ambient must follow the clock too — light surroundings (grass, mountains)
## glow unnaturally at night otherwise.
const DAY_KEYS := [
	[0.0,  -40.0, 0.22, Color(0.5, 0.62, 1.0),  Color(0.05, 0.07, 0.16), 0.8],
	[6.0,  -40.0, 0.22, Color(0.5, 0.62, 1.0),  Color(0.05, 0.07, 0.16), 0.8],
	[7.5,  -24.0, 2.1,  Color(1.0, 0.74, 0.5),  Color(0.85, 0.62, 0.45), 1.4],
	[10.0, -42.0, 3.0,  Color(1.0, 0.93, 0.82), Color(0.55, 0.75, 1.0),  2.0],
	[15.0, -46.0, 3.0,  Color(1.0, 0.95, 0.85), Color(0.55, 0.75, 1.0),  2.0],
	[18.0, -26.0, 2.2,  Color(1.0, 0.66, 0.4),  Color(0.9, 0.55, 0.35),  1.5],
	[19.5, -40.0, 0.22, Color(0.5, 0.62, 1.0),  Color(0.07, 0.09, 0.2),  0.8],
	[24.0, -40.0, 0.22, Color(0.5, 0.62, 1.0),  Color(0.05, 0.07, 0.16), 0.8],
]

var _day_timer := 0.0
var _hour_override := -1.0

func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--hour="):
			_hour_override = float(arg.split("=")[1])
	$Sun.rotation_degrees = Vector3(-46.0, 150.0, 0.0)
	_apply_daylight()

	if "--shot" in OS.get_cmdline_user_args():
		_take_shot()

	if "--wallpaper" in OS.get_cmdline_user_args():
		DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_BORDERLESS, true)
		DisplayServer.window_set_position(Vector2i.ZERO)
		DisplayServer.window_set_size(DisplayServer.screen_get_size())
		# Wallpaper rung: 30 fps, NATIVE render + MSAA 2x — the measured sweet
		# spot (FSR upscale read as jaggies; 4x MSAA costs +10% GPU for little
		# visible gain at wallpaper distance).
		Engine.max_fps = 30
		get_viewport().scaling_3d_scale = 1.0
		get_viewport().msaa_3d = Viewport.MSAA_2X
		var env: Environment = $WorldEnvironment.environment
		env.ssao_enabled = false
		env.ssr_max_steps = 24
		# Volumetric froxel pipeline is the big GPU cost — at wallpaper rung
		# the fake beam cards carry the god-ray look on their own.
		env.volumetric_fog_enabled = false
		# Smaller shadow atlas + no DOF: invisible at wallpaper distance.
		RenderingServer.directional_shadow_atlas_set_size(2048, true)
		var cam: Camera3D = $CameraRig/Camera3D
		cam.attributes.dof_blur_far_enabled = false
		cam.attributes.dof_blur_near_enabled = false

func _process(delta: float) -> void:
	_day_timer -= delta
	if _day_timer <= 0.0:
		_day_timer = 60.0  # re-evaluate once a minute
		_apply_daylight()

## Sun, sky and god-ray cards follow the machine's real local time (doc 3.4:
## lighting itself is a status display — glance at the office, read the day).
func _apply_daylight() -> void:
	var t := Time.get_time_dict_from_system()
	var hour: float = t.hour + t.minute / 60.0
	if _hour_override >= 0.0:
		hour = _hour_override
	var a: Array = DAY_KEYS[0]
	var b: Array = DAY_KEYS[DAY_KEYS.size() - 1]
	for i in DAY_KEYS.size() - 1:
		if hour >= DAY_KEYS[i][0] and hour <= DAY_KEYS[i + 1][0]:
			a = DAY_KEYS[i]
			b = DAY_KEYS[i + 1]
			break
	var f: float = 0.0 if b[0] == a[0] else (hour - a[0]) / (b[0] - a[0])
	var pitch: float = lerpf(a[1], b[1], f)
	var energy: float = lerpf(a[2], b[2], f)
	var sun_col: Color = a[3].lerp(b[3], f)
	var sky_col: Color = a[4].lerp(b[4], f)

	$Sun.rotation_degrees = Vector3(pitch, 150.0, 0.0)
	$Sun.light_energy = energy
	$Sun.light_color = sun_col
	var env: Environment = $WorldEnvironment.environment
	env.ambient_light_energy = lerpf(a[5], b[5], f)
	# Procedural sky is the IBL source (ambient + reflections) — keep its
	# colors on the clock so glossy floors mirror dawn/day/night correctly.
	if env.sky and env.sky.sky_material is ProceduralSkyMaterial:
		var sm: ProceduralSkyMaterial = env.sky.sky_material
		sm.sky_top_color = sky_col.darkened(0.25)
		sm.sky_horizon_color = sky_col.lightened(0.25)
		sm.ground_horizon_color = sky_col * Color(0.75, 0.8, 0.7)
	var world: Node3D = $World
	if world.sky_mat:
		world.sky_mat.emission = sky_col
		world.sky_mat.albedo_color = sky_col
	for bm in world.beam_mats:
		bm.set_shader_parameter("strength", 0.18 * clampf(energy / 2.6, 0.0, 1.0))
		bm.set_shader_parameter("tint", Color(sun_col.r, sun_col.g, sun_col.b * 0.8))

func _take_shot() -> void:
	await get_tree().create_timer(2.5).timeout
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var dir := ProjectSettings.globalize_path("res://").path_join("../shots")
	DirAccess.make_dir_recursive_absolute(dir)
	var path := dir.path_join("office_floor.png")
	img.save_png(path)
	print("screenshot saved: ", path)
	get_tree().quit()
