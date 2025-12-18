
import { Vector3, Euler, ShaderMaterial, Color } from 'three';

export interface MovementState {
  position: [number, number, number];
  rotation: [number, number, number];
  speed: number;
  wheelRotation: number;
  mode: 'car' | 'flight' | 'robot';
  isMoving: boolean;
}

export interface PartProps {
  isRobot: boolean;
  isFlight: boolean;
  doorOpen: boolean;
  speed: number;
  wheelRotation: number;
  time: number;
  color?: string;
}

// Type definition for the custom shader material props
export type SparkleShaderMaterialType = ShaderMaterial & {
  time: number;
  color: Color;
  size: number;
  pixelRatio: number;
};
