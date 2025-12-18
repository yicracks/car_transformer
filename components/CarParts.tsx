
import React, { useMemo, useRef } from 'react';
import { useFrame, extend, Object3DNode } from '@react-three/fiber';
import * as THREE from 'three';
import { SparkleShaderMaterial } from './SparkleMaterial';
import { PartProps, SparkleShaderMaterialType } from '../types';

// Register custom shader material
extend({ SparkleShaderMaterial });

// Fix: Use module augmentation to extend R3F's internal elements list.
// This avoids overwriting the global JSX namespace which can break standard HTML elements like div/span.
declare module '@react-three/fiber' {
  interface ThreeElements {
    sparkleShaderMaterial: Object3DNode<SparkleShaderMaterialType, typeof THREE.ShaderMaterial> & {
      time?: number;
      color?: string | THREE.Color;
      size?: number;
      pixelRatio?: number;
      transparent?: boolean;
      depthWrite?: boolean;
      blending?: number;
    };
  }
}

const TransformerPart: React.FC<{
  geometryType: 'box' | 'cylinder' | 'cone' | 'sphere';
  dims: number[];
  carPos: [number, number, number];
  carRot: [number, number, number];
  robotPos: [number, number, number];
  robotRot: [number, number, number];
  flightPos?: [number, number, number];
  flightRot?: [number, number, number];
  isRobot: boolean;
  isFlight: boolean;
  doorOpen: boolean;
  partType: string;
  speed?: number;
  wheelRotation?: number;
  time?: number;
  color?: string;
  opacity?: number;
}> = ({
  geometryType,
  dims,
  carPos,
  carRot,
  robotPos,
  robotRot,
  flightPos,
  flightRot,
  isRobot,
  isFlight,
  doorOpen,
  partType,
  wheelRotation = 0,
  time = 0,
  color = "#ff1493",
  opacity = 0.7
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<any>(null);
  
  const { positions, randomScales, geometry } = useMemo(() => {
    let geo: THREE.BufferGeometry;
    if (geometryType === 'box') geo = new THREE.BoxGeometry(dims[0], dims[1], dims[2], 2, 2, 2);
    else if (geometryType === 'cylinder') geo = new THREE.CylinderGeometry(dims[0], dims[1], dims[2], 16);
    else if (geometryType === 'sphere') geo = new THREE.SphereGeometry(dims[0], 16, 16);
    else geo = new THREE.ConeGeometry(dims[0], dims[1], 16);

    const count = Math.floor(dims[0] * dims[1] * (dims[2] || dims[0]) * 800) + 150;
    const posArray = new Float32Array(count * 3);
    const scaleArray = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const r = Math.random() * dims[0] * 0.5;
        const h = (Math.random() - 0.5) * (dims[1] || dims[0]);
        posArray[i * 3] = r * Math.sin(theta);
        posArray[i * 3 + 1] = h;
        posArray[i * 3 + 2] = r * Math.cos(theta);
        scaleArray[i] = Math.random();
    }
    return { positions: posArray, randomScales: scaleArray, geometry: geo };
  }, [geometryType, dims]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const lerpSpeed = 4 * delta;

    // Target Position calculation
    let targetP = new THREE.Vector3().fromArray(carPos);
    if (isRobot) targetP.fromArray(robotPos);
    else if (isFlight) targetP.fromArray(flightPos || carPos);
    groupRef.current.position.lerp(targetP, lerpSpeed);
    
    // Target Rotation calculation
    let qBase = new THREE.Quaternion().setFromEuler(new THREE.Euler(...carRot));
    if (isRobot) qBase.setFromEuler(new THREE.Euler(...robotRot));
    else if (isFlight) qBase.setFromEuler(new THREE.Euler(...(flightRot || carRot)));

    let dynamicQ = new THREE.Quaternion();
    
    // Scissor Doors / Flight Wings Logic
    if (partType.includes('door')) {
      if (isFlight) {
        // High-frequency, large-amplitude flapping for flight
        const flap = Math.sin(time * 10) * 0.8; 
        if (partType === 'door_left') dynamicQ.setFromEuler(new THREE.Euler(0, 0, Math.PI / 4 + flap));
        if (partType === 'door_right') dynamicQ.setFromEuler(new THREE.Euler(0, 0, -Math.PI / 4 - flap));
      } else if (doorOpen) {
        // Scissor open in car mode
        if (partType === 'door_left') dynamicQ.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2.2));
        if (partType === 'door_right') dynamicQ.setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2.2));
      }
    }

    // Wheel Rotation
    if (partType === 'wheel') {
       if (!isRobot) {
          dynamicQ.setFromEuler(new THREE.Euler(wheelRotation, 0, 0));
       }
    }

    const targetQ = qBase.clone().multiply(dynamicQ);
    groupRef.current.quaternion.slerp(targetQ, lerpSpeed);

    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.pixelRatio.value = state.viewport.dpr;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry}>
         <meshStandardMaterial color={color} roughness={0.02} metalness={1} transparent opacity={opacity} />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-randomScale" count={randomScales.length} array={randomScales} itemSize={1} />
        </bufferGeometry>
        <sparkleShaderMaterial 
            ref={materialRef} 
            transparent 
            depthWrite={false} 
            blending={THREE.AdditiveBlending}
            color={new THREE.Color(color)}
        />
      </points>
    </group>
  );
};

const DiamondDriver = ({ isRobot, isFlight, time }: { isRobot: boolean, isFlight: boolean, time: number }) => {
  const driverColor = "#00ffff"; // Glowing cyan for the driver
  
  // Position the driver inside the car/flight cockpit or robot chest
  return (
    <group>
      {/* Head */}
      <TransformerPart
        partType="driver_head"
        geometryType="sphere"
        dims={[0.15]}
        carPos={[0, 0.95, -0.3]} carRot={[0, 0, 0]}
        robotPos={[0, 4.4, 0.4]} robotRot={[0, 0, 0]}
        flightPos={[0, 0.95, -0.3]} flightRot={[0, 0, 0]}
        isRobot={isRobot} isFlight={isFlight} doorOpen={false} color={driverColor} opacity={0.9}
      />
      {/* Body */}
      <TransformerPart
        partType="driver_body"
        geometryType="box"
        dims={[0.25, 0.35, 0.2]}
        carPos={[0, 0.7, -0.3]} carRot={[0.3, 0, 0]}
        robotPos={[0, 4.1, 0.4]} robotRot={[0, 0, 0]}
        flightPos={[0, 0.7, -0.3]} flightRot={[0.3, 0, 0]}
        isRobot={isRobot} isFlight={isFlight} doorOpen={false} color={driverColor} opacity={0.8}
      />
    </group>
  );
};

export const CarAssembly = ({ isRobot, isFlight, doorOpen, wheelRotation, time }: PartProps) => {
  const pink = "#ff1493";
  const lightPink = "#ff69b4";
  const darkPink = "#c71585";

  return (
    <group>
      <DiamondDriver isRobot={isRobot} isFlight={isFlight} time={time} />

      {/* Torso / Cockpit Area */}
      <TransformerPart
        partType="torso"
        geometryType="box"
        dims={[2.4, 1.4, 1.2]}
        carPos={[0, 0.7, 0.1]} carRot={[0, 0, 0]}
        robotPos={[0, 4.0, 0]} robotRot={[0, 0, 0]}
        flightPos={[0, 0.7, 0.1]} flightRot={[0, 0, 0]}
        isRobot={isRobot} isFlight={isFlight} doorOpen={doorOpen} color={lightPink}
      />

      {/* Head of Robot */}
      <TransformerPart
        partType="head"
        geometryType="box"
        dims={[0.6, 0.8, 0.6]}
        carPos={[0, 0.7, 0.5]} carRot={[0, 0, 0]}
        robotPos={[0, 5.5, 0]} robotRot={[0, 0, 0]}
        flightPos={[0, 0.6, 0.5]} flightRot={[0, 0, 0]}
        isRobot={isRobot} isFlight={isFlight} doorOpen={doorOpen} color={darkPink}
      />

      {/* Wings / Doors */}
      <TransformerPart
        partType="door_left"
        geometryType="box"
        dims={[0.12, 1.3, 2.8]}
        carPos={[1.2, 0.9, -0.6]} carRot={[0, 0, 0]}
        robotPos={[1.5, 4.8, -1.0]} robotRot={[0, -0.4, 1.4]}
        flightPos={[1.2, 1.0, -0.6]} flightRot={[0, 0, 0.3]}
        isRobot={isRobot} isFlight={isFlight} doorOpen={doorOpen} time={time} color={lightPink}
      />
      
      <TransformerPart
        partType="door_right"
        geometryType="box"
        dims={[0.12, 1.3, 2.8]}
        carPos={[-1.2, 0.9, -0.6]} carRot={[0, 0, 0]}
        robotPos={[-1.5, 4.8, -1.0]} robotRot={[0, 0.4, -1.4]}
        flightPos={[-1.2, 1.0, -0.6]} flightRot={[0, 0, -0.3]}
        isRobot={isRobot} isFlight={isFlight} doorOpen={doorOpen} time={time} color={lightPink}
      />

      {/* Wheels */}
      {[ [1.3, 0.45, 1.8], [-1.3, 0.45, 1.8], [1.3, 0.45, -1.8], [-1.3, 0.45, -1.8] ].map((pos, i) => (
        <TransformerPart
          key={i}
          partType="wheel"
          geometryType="cylinder"
          dims={[0.48, 0.48, 0.35]}
          carPos={pos as [number, number, number]} carRot={[0, 0, Math.PI / 2]}
          robotPos={[i % 2 === 0 ? 2.5 : -2.5, i < 2 ? 4.8 : 0.4, 0]} robotRot={[0, 0, Math.PI / 2]}
          flightPos={[pos[0]*0.9, pos[1]+0.2, pos[2]]} flightRot={[Math.PI/2, 0, Math.PI/2]}
          isRobot={isRobot} isFlight={isFlight} doorOpen={doorOpen} wheelRotation={wheelRotation} color="#050505"
        />
      ))}

      {/* Chassis / Waist */}
      <TransformerPart
        partType="waist"
        geometryType="box"
        dims={[2.0, 0.8, 3.5]}
        carPos={[0, 0.4, -0.2]} carRot={[0, 0, 0]}
        robotPos={[0, 2.8, 0]} robotRot={[0, 0, 0]}
        flightPos={[0, 0.35, -0.2]} flightRot={[0, 0, 0]}
        isRobot={isRobot} isFlight={isFlight} doorOpen={doorOpen} color={pink}
      />

      {/* Lower Legs / Engines */}
      <TransformerPart
        partType="leg_l"
        geometryType="box"
        dims={[0.8, 2.8, 1.0]}
        carPos={[0.5, 0.4, -1.5]} carRot={[0, 0, 0]}
        robotPos={[0.7, 1.2, 0]} robotRot={[0, 0, 0]}
        flightPos={[0.5, 0.4, -1.5]} flightRot={[0, 0, 0]}
        isRobot={isRobot} isFlight={isFlight} doorOpen={doorOpen} color={darkPink}
      />
      <TransformerPart
        partType="leg_r"
        geometryType="box"
        dims={[0.8, 2.8, 1.0]}
        carPos={[-0.5, 0.4, -1.5]} carRot={[0, 0, 0]}
        robotPos={[-0.7, 1.2, 0]} robotRot={[0, 0, 0]}
        flightPos={[-0.5, 0.4, -1.5]} flightRot={[0, 0, 0]}
        isRobot={isRobot} isFlight={isFlight} doorOpen={doorOpen} color={darkPink}
      />
    </group>
  );
};
