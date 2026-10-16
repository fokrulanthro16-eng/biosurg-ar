import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const cwd = process.cwd();
const shotsDir = path.join(cwd, 'screenshots');

const images = [
  '04_specs_waveguide_hud_radar_4k.png',
  '01_nir_hypoxia_heatmap_4k.png',
  '02_microtremor_holographic_cone_4k.png',
  '03_exploded_tissue_layers_4k.png',
  '05_endovascular_lumen_entry_4k.png',
  '06_leaf_14_verification_matrix_4k.png'
];

let concatTxt = '';
for (const img of images) {
  const fullPath = path.join(shotsDir, img).replace(/\\/g, '/');
  concatTxt += `file '${fullPath}'\nduration 8\n`;
}
concatTxt += `file '${path.join(shotsDir, images[images.length - 1]).replace(/\\/g, '/')}'\n`;

const concatPath = path.join(cwd, 'video_input.txt');
fs.writeFileSync(concatPath, concatTxt);

const audioWav = path.join(cwd, 'temp_audio.wav');
const outMp4 = path.join(cwd, 'biosurg-demo.mp4');

console.log('[Video] 1. Synthesizing cardiac audio...');
// Simple clean sine tone with periodic beep
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=880:duration=48" -af "volume=0.25" "${audioWav}"`, { stdio: 'inherit' });

console.log('[Video] 2. Rendering video with ffmpeg...');
const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${concatPath}" -i "${audioWav}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p" -c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 192k -shortest "${outMp4}"`;

execSync(ffmpegCmd, { stdio: 'inherit' });

if (fs.existsSync(concatPath)) fs.unlinkSync(concatPath);
if (fs.existsSync(audioWav)) fs.unlinkSync(audioWav);

const stat = fs.statSync(outMp4);
console.log(`[Video] Generated biosurg-demo.mp4 successfully! Size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
