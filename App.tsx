
import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { CarAssembly } from './components/CarParts';

const CONTROLS_CONFIG = {
  acceleration: 0.02,
  deceleration: 0.95,
  maxSpeed: 0.8,
  turnSpeed: 0.04,
  liftSpeed: 0.1,
};

// Sub-component to handle movement and camera follow
function VehicleController({ mode, doorOpen }: { mode: 'car' | 'flight' | 'robot', doorOpen: boolean }) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<any>(null);
  
  // Movement states
  const keys = useRef<{ [key: string]: boolean }>({});
  const velocity = useRef(0);
  const rotY = useRef(0);
  const height = useRef(0);
  const banking = useRef(0);
  const wheelRot = useRef(0);
  const worldPos = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const handleUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const isMovingForward = keys.current['ArrowUp'] || keys.current['KeyW'];
    const isMovingBackward = keys.current['ArrowDown'] || keys.current['KeyS'];
    const isTurningLeft = keys.current['ArrowLeft'] || keys.current['KeyA'];
    const isTurningRight = keys.current['ArrowRight'] || keys.current['KeyD'];

    const isRobot = mode === 'robot';
    const isFlight = mode === 'flight';

    // Physics logic
    // 1. Acceleration
    const currentAccel = isRobot ? CONTROLS_CONFIG.acceleration * 0.5 : CONTROLS_CONFIG.acceleration;
    const currentMaxSpeed = isFlight ? CONTROLS_CONFIG.maxSpeed * 1.5 : isRobot ? CONTROLS_CONFIG.maxSpeed * 0.4 : CONTROLS_CONFIG.maxSpeed;

    if (isMovingForward) velocity.current = Math.min(velocity.current + currentAccel, currentMaxSpeed);
    else if (isMovingBackward) velocity.current = Math.max(velocity.current - currentAccel, -currentMaxSpeed * 0.5);
    else velocity.current *= CONTROLS_CONFIG.deceleration;

    // 2. Steering (Only steer if moving or in flight/robot mode)
    const steerEffect = (isFlight || isRobot || Math.abs(velocity.current) > 0.01) ? (velocity.current >= 0 ? 1 : -1) : 0;
    const currentTurnSpeed = isFlight ? CONTROLS_CONFIG.turnSpeed * 1.2 : isRobot ? CONTROLS_CONFIG.turnSpeed * 0.8 : CONTROLS_CONFIG.turnSpeed;
    
    if (isTurningLeft) rotY.current += currentTurnSpeed * steerEffect;
    if (isTurningRight) rotY.current -= currentTurnSpeed * steerEffect;

    // 3. Banking & Height
    const targetBanking = isFlight ? (isTurningLeft ? 0.4 : isTurningRight ? -0.4 : 0) : 0;
    banking.current = THREE.MathUtils.lerp(banking.current, targetBanking, 0.1);

    const targetHeight = isFlight ? 4.0 + Math.sin(state.clock.elapsedTime * 2) * 0.3 : 0;
    height.current = THREE.MathUtils.lerp(height.current, targetHeight, 0.05);

    // 4. Update Position
    const moveX = Math.sin(rotY.current) * velocity.current;
    const moveZ = Math.cos(rotY.current) * velocity.current;
    
    worldPos.current.x += moveX;
    worldPos.current.z += moveZ;
    worldPos.current.y = height.current;

    // Apply to group
    groupRef.current.position.copy(worldPos.current);
    groupRef.current.rotation.set(banking.current, rotY.current, 0);

    // 5. Wheel rotation
    wheelRot.current += velocity.current * 3;

    // 6. Camera Follow
    if (controlsRef.current) {
        const targetPoint = worldPos.current.clone().add(new THREE.Vector3(0, isRobot ? 3.0 : 0.8, 0));
        controlsRef.current.target.lerp(targetPoint, 0.1);
    }
  });

  return (
    <>
      <OrbitControls 
        ref={controlsRef}
        enablePan={false} 
        minPolarAngle={0.1} 
        maxPolarAngle={Math.PI / 2 - 0.05} 
        minDistance={10}
        maxDistance={45}
      />
      <group ref={groupRef}>
        <CarAssembly 
          isRobot={mode === 'robot'} 
          isFlight={mode === 'flight'} 
          doorOpen={doorOpen} 
          wheelRotation={wheelRot.current}
          speed={velocity.current}
          time={Date.now() / 1000}
        />
      </group>
    </>
  );
}

export default function App() {
  const [mode, setMode] = useState<'car' | 'flight' | 'robot'>('car');
  const [doorOpen, setDoorOpen] = useState(false);

  const toggleTransform = () => {
    setMode(prev => prev === 'robot' ? 'car' : 'robot');
    setDoorOpen(false);
  };

  const toggleFlight = () => {
    setMode(prev => prev === 'flight' ? 'car' : 'flight');
    setDoorOpen(false);
  };

  const toggleDoor = () => {
    if (mode === 'car') setDoorOpen(prev => !prev);
  };

  return (
    <div className="relative w-full h-full bg-black">
      <Canvas gl={{ antialias: false }} dpr={[1, 2]} shadows>
        <PerspectiveCamera makeDefault position={[15, 12, 18]} fov={40} />
        
        <color attach="background" args={['#020202']} />
        <ambientLight intensity={0.6} />
        <spotLight position={[30, 50, 30]} angle={0.4} penumbra={1} intensity={6} color="#ff80bf" castShadow />
        <pointLight position={[-30, 20, -20]} intensity={3} color="#00ffff" />
        <Environment preset="night" />
        <Stars radius={150} depth={60} count={12000} factor={7} saturation={0} fade speed={2} />

        <Suspense fallback={null}>
          <VehicleController mode={mode} doorOpen={doorOpen} />
        </Suspense>

        <ContactShadows resolution={1024} scale={100} blur={2.5} opacity={0.5} far={15} color="#ff007f" />
        
        {/* Infinite Grid Floor */}
        <gridHelper args={[2000, 100, '#ff007f', '#111']} position={[0, -0.05, 0]} opacity={0.15} transparent />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
          <planeGeometry args={[2000, 2000]} />
          <meshStandardMaterial color="#050505" roughness={0.1} metalness={0.8} />
        </mesh>

        <Suspense fallback={null}>
          <EffectComposer disableNormalPass>
            <Bloom luminanceThreshold={0.15} intensity={2.2} radius={0.7} color="#ff007f" />
            <Vignette offset={0.25} darkness={0.95} />
          </EffectComposer>
        </Suspense>
      </Canvas>

      {/* Navigation UI */}
      <div className="absolute top-10 left-10 p-6 bg-black/60 backdrop-blur-2xl border border-pink-500/40 rounded-sm pointer-events-none shadow-[0_0_30px_rgba(255,0,127,0.2)]">
         <h2 className="text-pink-400 font-black text-2xl mb-3 tracking-widest uppercase italic border-b border-pink-500/30 pb-2">Control Deck</h2>
         <div className="space-y-2 font-mono text-xs uppercase tracking-wider">
           <div className="flex justify-between gap-8"><span className="text-pink-200/50">Movement</span> <span className="text-white">ARROWS / WASD</span></div>
           <div className="flex justify-between gap-8"><span className="text-pink-200/50">Steering</span> <span className="text-white">LEFT / RIGHT</span></div>
           <div className="flex justify-between gap-8"><span className="text-pink-200/50">Mode Status</span> <span className="text-pink-400 animate-pulse">{mode}</span></div>
         </div>
      </div>

      {/* Main Title & Mode Switcher */}
      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center justify-center pointer-events-none gap-8">
        <div className="text-center">
            <h1 className="text-white text-5xl font-black tracking-[0.4em] drop-shadow-[0_0_30px_rgba(255,0,127,1)] uppercase italic leading-none">
              Diamond Pink
            </h1>
            <div className="text-pink-500 font-bold tracking-[1em] text-sm mt-2 uppercase opacity-80">
                {mode === 'robot' ? 'Guardian Unit' : mode === 'flight' ? 'Aero Interceptor' : 'Supercar Core'}
            </div>
        </div>
        
        <div className="flex gap-6 pointer-events-auto">
          <button 
            onClick={toggleTransform}
            className={`group relative px-10 py-5 overflow-hidden transition-all duration-500 ${mode === 'robot' ? 'bg-pink-600 text-white' : 'bg-transparent text-pink-500'} border-2 border-pink-500 hover:shadow-[0_0_40px_rgba(255,0,127,0.5)]`}
          >
            <span className="relative z-10 font-black tracking-widest uppercase italic">Robot Protocol</span>
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </button>

          <button 
            onClick={toggleFlight}
            className={`group relative px-10 py-5 overflow-hidden transition-all duration-500 ${mode === 'flight' ? 'bg-pink-400 text-white' : 'bg-transparent text-pink-400'} border-2 border-pink-400 hover:shadow-[0_0_40px_rgba(255,100,200,0.5)]`}
          >
            <span className="relative z-10 font-black tracking-widest uppercase italic">Flight Protocol</span>
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </button>

          {mode === 'car' && (
            <button 
              onClick={toggleDoor}
              className="px-10 py-5 font-bold text-pink-200 border border-pink-500/40 bg-pink-900/20 backdrop-blur-md hover:bg-pink-500/40 transition-all uppercase tracking-widest shadow-inner"
            >
              {doorOpen ? "Seal Doors" : "Deploy Wings"}
            </button>
          )}
        </div>

        <div className="text-pink-500/40 text-[10px] font-mono tracking-[0.6em] uppercase">
            Systems Online • Ready for engagement
        </div>
      </div>
    </div>
  );
}
