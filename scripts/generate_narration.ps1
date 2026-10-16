Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice("Microsoft David Desktop")
$synth.Rate = 1

$outWav = Join-Path (Get-Location) "narration.wav"
$synth.SetOutputToWaveFile($outWav)

$builder = New-Object System.Speech.Synthesis.PromptBuilder

# Phase 1: Intro & Waveguide Optical Calibration (0s - 25s)
$builder.AppendText("Welcome to BioSurg AR version 3.0, the quantum autonomous microsurgical AR suite engineered for Snap SPECS.")
$builder.AppendBreak([TimeSpan]::FromMilliseconds(500))
$builder.AppendText("In acute neurovascular trauma, seconds dictate limb salvage. BioSurg AR delivers holographic guidance directly in the surgeon's field of view with an ultra-low 5.4 percent FOV occlusion and 99.9 percent quantum neural tracking lock.")
$builder.AppendBreak([TimeSpan]::FromSeconds(1.5))

# Phase 2: Scan Vessels & Hyperspectral NIR (25s - 58s)
$builder.AppendText("Initiating vessel scan.")
$builder.AppendBreak([TimeSpan]::FromMilliseconds(500))
$builder.AppendText("Transitioning into Hyperspectral Near-Infrared transillumination. Our custom WebGL2 shader highlights deep ischemic tissue glowing in amber and hypoxic magenta.")
$builder.AppendBreak([TimeSpan]::FromMilliseconds(500))
$builder.AppendText("Clinical telemetry tracks hypovolemic shock: tachycardia at 110 beats per minute, Lead-Two ECG R-wave spikes, blood pressure of 82 over 48, and SpO2 at 88 percent.")
$builder.AppendBreak([TimeSpan]::FromSeconds(1.5))

# Phase 3: Cross Section & Exploded View (58s - 92s)
$builder.AppendText("Activating dynamic cross-section exploded view.")
$builder.AppendBreak([TimeSpan]::FromMilliseconds(500))
$builder.AppendText("The quad-layer kinematics engine separates tissue layers in 3D space: epidermis separates by positive 18 millimeters, and fascia by positive 9 millimeters, exposing the radial artery arborization and skeletal radius and ulna.")
$builder.AppendBreak([TimeSpan]::FromMilliseconds(500))
$builder.AppendText("Simultaneously, acoustic tissue occlusion opens the Doppler low-pass filter from minus 16 decibels up to full zero decibel clarity, delivering crisp Pulsed-Wave Doppler blood turbulence.")
$builder.AppendBreak([TimeSpan]::FromSeconds(1.5))

# Phase 4: Guide Needle & AI Micro-Tremor Stabilization (92s - 126s)
$builder.AppendText("Engaging surgical needle guidance.")
$builder.AppendBreak([TimeSpan]::FromMilliseconds(500))
$builder.AppendText("Our AI Kalman filter suppresses physiological hand tremors by over 84 percent, achieving sub-millimeter stability below 0.02 millimeters. The 25-degree holographic laser cone projects Fresnel safety boundaries with live millimeter depth rings.")
$builder.AppendBreak([TimeSpan]::FromMilliseconds(500))
$builder.AppendText("On the left diagnostics matrix, live B-Mode ultrasound radar tracks the hyperechoic cannula tip advancing toward the anechoic vessel lumen.")
$builder.AppendBreak([TimeSpan]::FromSeconds(1.5))

# Phase 5: Reticle Dwell Lock & LEAF 14/14 Matrix (126s - 155s)
$builder.AppendText("Target depth reached at 4.2 millimeters. The holographic reticle confirms lumen target acquisition lock.")
$builder.AppendBreak([TimeSpan]::FromMilliseconds(500))
$builder.AppendText("Cannula placement restores perfusion. SpO2 rises to 98 percent, and arterial pressure stabilizes to 118 over 76.")
$builder.AppendBreak([TimeSpan]::FromMilliseconds(500))
$builder.AppendText("All 14 LEAF criteria pass with a 100 percent compliance score, cryptographically sealed into a tamper-proof SHA-256 DICOM audit ledger.")
$builder.AppendBreak([TimeSpan]::FromMilliseconds(500))
$builder.AppendText("BioSurg AR v3.0: autonomous, sub-millimeter surgical precision for Snap SPECS.")

$synth.Speak($builder)
$synth.Dispose()
