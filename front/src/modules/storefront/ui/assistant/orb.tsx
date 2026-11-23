"use client"

import { useEffect, useRef, useState } from "react"

// A living sphere of particles in the four colours (normal blending so the colours stay distinct instead of adding up to white) of the Arisma Didácticos logo. Three.js is loaded only on this
// page and only when WebGL works; otherwise (or while loading) a still ring of coloured dots stands in.

const TONES = [0xff1850, 0x29aae2, 0xfd931f, 0x79c942]

const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;
vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}`

export function Orb({ active }: { active: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const [webgl, setWebgl] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let disposed = false
    let cleanup = () => {}
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    import("three").then(async (THREE) => {
      if (disposed) return
      let renderer: InstanceType<typeof THREE.WebGLRenderer>
      try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }) } catch { return }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100)
      camera.position.z = 3.2
      const geometry = new THREE.IcosahedronGeometry(1, 22)
      const count = geometry.attributes.position.count
      const colors = new Float32Array(count * 3)
      const color = new THREE.Color()
      for (let i = 0; i < count; i++) { color.setHex(TONES[i % TONES.length]); colors.set([color.r, color.g, color.b], i * 3) }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))

      const dot = document.createElement("canvas")
      dot.width = dot.height = 32
      const ctx = dot.getContext("2d")!
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(16, 16, 16, 0, Math.PI * 2); ctx.fill()
      const texture = new THREE.CanvasTexture(dot)
      const material = new THREE.PointsMaterial({ map: texture, vertexColors: true, transparent: true, depthWrite: false, opacity: 0.85 })
      const uniforms = { time: { value: 0 } }
      material.onBeforeCompile = (shader) => {
        shader.uniforms.time = uniforms.time
        shader.vertexShader = `uniform float time;\n${NOISE}\n${shader.vertexShader}`
          .replace("#include <begin_vertex>", `vec3 p=position;float n=snoise(vec3(p.x*.6+time*.2,p.y*.4+time*.3,p.z*.2+time*.2));p+=n*.4;p*=1.45/length(p);float s=mix(.012,.07,n);vec3 transformed=p;`)
          .replace("gl_PointSize = size;", "gl_PointSize = s;")
      }
      const points = new THREE.Points(geometry, material)
      scene.add(points)

      const resize = () => {
        const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight)
        camera.aspect = w / h
        camera.position.z = 3.2 / Math.min(1, camera.aspect)
        camera.updateProjectionMatrix()
        renderer.setSize(w, h, false)
      }
      const observer = new ResizeObserver(resize)
      observer.observe(el)
      resize()
      const release = () => { observer.disconnect(); geometry.dispose(); material.dispose(); texture.dispose(); renderer.dispose(); renderer.domElement.remove() }
      cleanup = release

      // The shader is compiled off the main thread where the browser allows it, so the page keeps scrolling meanwhile;
      // the still ring of dots stays until the sphere can draw its first frame.
      try { await renderer.compileAsync(points, camera, scene) } catch { /* compiled on the first render instead */ }
      if (disposed) { release(); return }
      el.appendChild(renderer.domElement)
      setWebgl(true)

      // it only draws while it is on screen and the tab is visible
      let frame = 0, onScreen = true
      const tick = () => {
        frame = requestAnimationFrame(tick)
        const t = performance.now() * 0.001 * (reduce ? 0.15 : 1)
        uniforms.time.value = t
        points.rotation.y = t * 0.2
        renderer.render(scene, camera)
      }
      const run = () => { if (!frame && onScreen && !document.hidden) tick() }
      const halt = () => { cancelAnimationFrame(frame); frame = 0 }
      const watch = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; if (onScreen) run(); else halt() })
      watch.observe(el)
      const onVisibility = () => (document.hidden ? halt() : run())
      document.addEventListener("visibilitychange", onVisibility)
      run()

      cleanup = () => { halt(); watch.disconnect(); document.removeEventListener("visibilitychange", onVisibility); release() }
    }).catch(() => {})

    return () => { disposed = true; cleanup() }
  }, [])

  return (
    <div className="orb" data-active={active} aria-hidden="true">
      <div ref={host} className="orb-canvas" />
      {!webgl && (
        <svg className="orb-fallback" viewBox="0 0 200 200">
          {Array.from({ length: 48 }, (_, i) => {
            const a = (i / 48) * Math.PI * 2
            return <circle key={i} cx={Math.round(100 + Math.cos(a) * 70)} cy={Math.round(100 + Math.sin(a) * 70)} r={2.5} fill={["#ff1850", "#29aae2", "#fd931f", "#79c942"][i % 4]} />
          })}
        </svg>
      )}
    </div>
  )
}
