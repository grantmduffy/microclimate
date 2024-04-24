
in vec2 vert_pos;
out vec2 xy;
out vec3 xyz;

void main(){
    gl_Position = vec4(vert_pos, .99, 1.);
    xy = vert_pos * 0.5 + 0.5;
    xyz = vec3(xy, 0.);
}
