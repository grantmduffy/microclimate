
uniform mat4 M_camera;
uniform mat4 M_camera_inv;
uniform float near;
uniform float far;

in vec3 vert_pos;
out vec4 xyz;

void main(){
    // gl_Position = vec4((vert_pos * 2. - 1.) * 0.98, 1.);
    vec4 xyz_close = M_camera_inv * vec4(vert_pos.xy * 2. - 1., -1., 1.);
    xyz_close /= xyz_close.w;
    vec4 xyz_far = M_camera_inv * vec4(vert_pos.xy * 2. - 1., 1., 1.);
    xyz_far /= xyz_far.w;
    xyz = vert_pos.z * (xyz_far - xyz_close) + xyz_close;
    xyz /= xyz.w;
    gl_Position = M_camera * xyz;
}