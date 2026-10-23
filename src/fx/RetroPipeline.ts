import Phaser from 'phaser';
import { createRetroPaletteLut, onRetroSettings, retroSettings } from '../data/retro';
import { newCanvas } from '../util/canvas';

const NODE = 'EvoRetro16Bit';
const LUT = '__evoRetroPalette';

/**
 * Single-pass camera post-processing. Phaser 4's BaseFilterShader replaces Phaser 3's PostFXPipeline;
 * the sampler/varying convention is shared. No blur, scanline overlay or time-dependent noise.
 */
export const RETRO_FRAGMENT = `
#pragma phaserTemplate(shaderName)
precision highp float;
uniform sampler2D uMainSampler;
uniform sampler2D uPaletteLut;
uniform vec2 uResolution;
uniform float uPixelSize;
uniform float uContrast;
uniform float uSaturation;
uniform float uDither;
varying vec2 outTexCoord;

// Ordered 4x4 Bayer, aligned to logical pixels so the pattern cannot shimmer inside a pixel block.
float bayer(vec2 pixel) {
    vec2 p = mod(pixel, 4.0);
    vec2 lo = mod(p, 2.0);
    vec2 hi = floor(p / 2.0);
    float a = 2.0 * lo.x + 3.0 * lo.y - 4.0 * lo.x * lo.y;
    float b = 2.0 * hi.x + 3.0 * hi.y - 4.0 * hi.x * hi.y;
    return (4.0 * a + b + 0.5) / 16.0 - 0.5;
}

vec3 palette(vec3 colour) {
    vec3 index = floor(colour * 31.0 + 0.5);
    return texture2D(uPaletteLut, vec2((index.r + index.g * 32.0 + 0.5) / 1024.0, (index.b + 0.5) / 32.0)).rgb;
}

void main() {
    float size = max(1.0, floor(uPixelSize));
    vec2 logicalPixel = floor(outTexCoord * uResolution / size);
    vec2 centre = (logicalPixel + 0.5) * size;
    // Exactly one source texel per block; do not average neighbouring edges into blurry pixels.
    vec2 uv = clamp(floor(centre) + 0.5, vec2(0.5), uResolution - 0.5) / uResolution;
    vec4 source = texture2D(uMainSampler, uv);
    if (source.a < 0.001) { gl_FragColor = vec4(0.0); return; }
    vec3 colour = source.rgb / source.a;
    // A small midtone lift preserves silhouettes and eyes against deep navy backgrounds.
    colour = pow(max(colour, vec3(0.0)), vec3(0.93));
    float luma = dot(colour, vec3(0.299, 0.587, 0.114));
    colour = mix(vec3(luma), colour, uSaturation);
    colour = (colour - 0.38) * uContrast + 0.38;
    colour += bayer(logicalPixel) * uDither * 0.025;
    colour = palette(clamp(colour, 0.0, 1.0));
    gl_FragColor = vec4(colour * source.a, source.a);
}
`;

export class Retro16BitPipeline extends Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader {
  constructor(manager: Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager) {
    super(NODE, manager, undefined, RETRO_FRAGMENT);
  }

  setupTextures(_controller: Phaser.Filters.Controller, textures: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper[]) {
    textures[1] = this.manager.renderer.game.textures.get(LUT).source[0].glTexture!;
    // Sprite batches intentionally use maxTextures=1 for Phaser 4 driver compatibility.
    // bindUnits caps its array at that value; bind this standalone filter's second sampler explicitly.
    this.manager.renderer.glTextureUnits.bind(textures[1], 1);
  }

  setupUniforms(_controller: Phaser.Filters.Controller, context: Phaser.Renderer.WebGL.DrawingContext) {
    const p = this.programManager, s = retroSettings;
    p.setUniform('uPaletteLut', 1);
    p.setUniform('uResolution', [context.width, context.height]);
    p.setUniform('uPixelSize', s.pixelSize);
    p.setUniform('uContrast', s.contrast);
    p.setUniform('uSaturation', s.saturation);
    p.setUniform('uDither', s.dither);
  }
}

/** Apply only to the world camera. HudScene's separate camera never receives this controller. */
export function installRetroPipeline(scene: Phaser.Scene): Phaser.Filters.Controller | undefined {
  if (scene.game.renderer.type !== Phaser.WEBGL) return undefined;
  const renderer = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  if (!scene.textures.exists(LUT)) {
    const [canvas, ctx] = newCanvas(1024, 32);
    const pixels = ctx.createImageData(1024, 32);
    pixels.data.set(createRetroPaletteLut());
    ctx.putImageData(pixels, 0, 0);
    const texture = scene.textures.addCanvas(LUT, canvas)!;
    // This is a data table, not artwork: row 0 must stay row 0 in GLSL.
    texture.source[0].setFlipY(false);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  if (!renderer.renderNodes.hasNode(NODE)) renderer.renderNodes.addNodeConstructor(NODE, Retro16BitPipeline);
  const camera = scene.cameras.main;
  const controller = new Phaser.Filters.Controller(camera, NODE);
  controller.active = retroSettings.enabled;
  camera.filters.internal.add(controller);
  const off = onRetroSettings(() => { controller.active = retroSettings.enabled; });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  return controller;
}
