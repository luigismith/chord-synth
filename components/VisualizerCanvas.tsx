import React, { useRef, useEffect, useState, useCallback } from 'react';
import { KnobState } from '../types';
import { audioService } from '../services/audioService';

interface VisualizerCanvasProps {
  knobs: KnobState[];
  activeArpNote: number | null;
}

const colorSchemes = {
    synthwavePink: { primary: [236, 72, 153], particle: [236, 72, 153], grid: [236, 72, 153] },
    cyberCyan: { primary: [6, 182, 212], particle: [6, 182, 212], grid: [6, 182, 212] },
    solarFlare: { primary: [245, 158, 11], particle: [245, 158, 11], grid: [245, 158, 11] },
};

interface Particle {
    x: number;
    y: number;
    size: number;
    baseSize: number;
    speedX: number;
    speedY: number;
    alpha: number;
    isFadingOut: boolean;
}

interface ArpNoteVisual {
    note: number;
    x: number;
    alpha: number;
    height: number;
}

const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({ knobs, activeArpNote }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const mousePosition = useRef<{ x: number | null, y: number | null }>({ x: null, y: null });
    const gridOffset = useRef(0);
    const arpNoteVisuals = useRef<ArpNoteVisual[]>([]);
    
    const [activeColorScheme, setActiveColorScheme] = useState('synthwavePink');
    const [particleDensity, setParticleDensity] = useState(50);

    const currentColors = useRef(colorSchemes.synthwavePink);

    const activeTouches = useRef(new Map<number, { x: number, y: number }>());

    const resetParticles = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        particlesRef.current = [];
        const numberOfParticles = Math.floor((canvas.clientWidth * canvas.clientHeight / 10000) * (particleDensity / 100));
        for (let i = 0; i < numberOfParticles; i++) {
            const baseSize = Math.random() * 2 + 1;
            particlesRef.current.push({
                x: Math.random() * canvas.clientWidth,
                y: Math.random() * canvas.clientHeight,
                size: baseSize,
                baseSize: baseSize,
                speedX: Math.random() * 1 - 0.5,
                speedY: Math.random() * 1 - 0.5,
                alpha: 1,
                isFadingOut: false,
            });
        }
    }, [particleDensity]);

    const handleTouchUpdate = useCallback(() => {
        const touches = Array.from(activeTouches.current.values());
        const canvas = canvasRef.current;
        if (!canvas || touches.length === 0) return;

        const avg = touches.reduce((acc, t) => ({ x: acc.x + t.x, y: acc.y + t.y }), { x: 0, y: 0 });
        avg.x /= touches.length;
        avg.y /= touches.length;

        const cutoff = (avg.x / canvas.clientWidth) * 100;
        const resonance = (1 - (avg.y / canvas.clientHeight)) * 100;

        audioService.setFilterCutoff(Math.max(0, Math.min(100, cutoff)));
        audioService.setFilterResonance(Math.max(0, Math.min(100, resonance)));

        if (touches.length >= 2) {
            const [t1, t2] = touches;
            const dx = t1.x - t2.x;
            const dy = t1.y - t2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxDistance = Math.sqrt(Math.pow(canvas.clientWidth, 2) + Math.pow(canvas.clientHeight, 2));
            const fxDepth = (distance / (maxDistance * 0.75)) * 100;
            audioService.setFxDepth(Math.max(0, Math.min(100, fxDepth)));
        }
    }, []);

    const returnToKnobValues = useCallback(() => {
        const cutoffKnob = knobs.find(k => k.id === 5)?.value ?? 80;
        const resKnob = knobs.find(k => k.id === 6)?.value ?? 20;
        const fxKnob = knobs.find(k => k.id === 4)?.value ?? 40;

        audioService.setFilterCutoff(cutoffKnob);
        audioService.setFilterResonance(resKnob);
        audioService.setFxDepth(fxKnob);
    }, [knobs]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const onTouchStart = (e: TouchEvent) => { /* ... */ };
        const onTouchMove = (e: TouchEvent) => { /* ... */ };
        const onTouchEnd = (e: TouchEvent) => { /* ... */ };
    }, [handleTouchUpdate, returnToKnobValues]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const handleResize = () => { /* ... */ };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [resetParticles]);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const handleMouseMove = (event: MouseEvent) => { /* ... */ };
        const handleMouseLeave = () => { /* ... */ };
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        return () => { /* ... */ };
    }, []);

    // Effect for smooth particle density changes
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !canvas.clientWidth) return;

        const targetCount = Math.floor((canvas.clientWidth * canvas.clientHeight / 10000) * (particleDensity / 100));
        const currentCount = particlesRef.current.filter(p => !p.isFadingOut).length;
        
        if (currentCount < targetCount) {
            const newParticles: Particle[] = [];
            for (let i = 0; i < targetCount - currentCount; i++) {
                const baseSize = Math.random() * 2 + 1;
                newParticles.push({
                    x: Math.random() * canvas.clientWidth,
                    y: Math.random() * canvas.clientHeight,
                    size: baseSize,
                    baseSize: baseSize,
                    speedX: Math.random() * 1 - 0.5,
                    speedY: Math.random() * 1 - 0.5,
                    alpha: 0, // Start transparent for fade-in
                    isFadingOut: false,
                });
            }
            particlesRef.current = [...particlesRef.current, ...newParticles];
        } else if (currentCount > targetCount) {
            let toFade = currentCount - targetCount;
            for (let i = particlesRef.current.length - 1; i >= 0 && toFade > 0; i--) {
                const particle = particlesRef.current[i];
                if (!particle.isFadingOut) {
                    particle.isFadingOut = true;
                    toFade--;
                }
            }
        }

    }, [particleDensity, canvasRef.current?.width]);


    const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, color: string) => { /* ... */ };
    const drawTouchFeedback = (ctx: CanvasRenderingContext2D, scheme: any) => { /* ... */ };

     useEffect(() => {
        if (activeArpNote !== null && canvasRef.current) {
            const canvas = canvasRef.current;
             // Map MIDI note (21-108 for a standard 88-key piano) to canvas width
            const noteRange = 108 - 21;
            const normalizedNote = (activeArpNote - 21) / noteRange;
            const x = normalizedNote * canvas.clientWidth;

            arpNoteVisuals.current.push({
                note: activeArpNote,
                x: x,
                alpha: 1.0,
                height: 0, // Start height
            });
        }
    }, [activeArpNote]);


    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const analyser = audioService.getAnalyser();
        if (!ctx || !analyser) return;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            if (!canvasRef.current) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // --- Smooth Color Transition ---
            const targetScheme = colorSchemes[activeColorScheme as keyof typeof colorSchemes];
            for (const key in targetScheme) {
                for (let i = 0; i < 3; i++) {
                    currentColors.current[key as keyof typeof targetScheme][i] += (targetScheme[key as keyof typeof targetScheme][i] - currentColors.current[key as keyof typeof targetScheme][i]) * 0.05;
                }
            }
            const cc = currentColors.current;
            const primaryColor = `rgb(${cc.primary[0]}, ${cc.primary[1]}, ${cc.primary[2]})`;
            const gridColor = `rgba(${cc.grid[0]}, ${cc.grid[1]}, ${cc.grid[2]}, 0.2)`;

            gridOffset.current = (gridOffset.current + 0.2) % 500;
            drawGrid(ctx, canvas.clientWidth, canvas.clientHeight, gridColor);

            analyser.getByteTimeDomainData(dataArray);

            let sum = 0; for (let i = 0; i < bufferLength; i++) { const v = dataArray[i] / 128.0 - 1.0; sum += v * v; }
            const rms = Math.sqrt(sum / bufferLength); const sizeMultiplier = 1 + Math.min(rms * 5, 1) * 2.5;

            // --- Particle Update and Draw ---
            particlesRef.current = particlesRef.current.filter(p => {
                if (p.isFadingOut) p.alpha -= 0.02; else if (p.alpha < 1) p.alpha += 0.02;
                if (p.alpha <= 0) return false; // Remove faded-out particles
                // ... (particle movement logic)
                p.size += ((p.baseSize * sizeMultiplier) - p.size) * 0.1;
                
                ctx.fillStyle = `rgba(${cc.particle[0]}, ${cc.particle[1]}, ${cc.particle[2]}, ${p.alpha * 0.7})`;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
                return true;
            });

            // --- Draw Arp Note Visuals ---
            arpNoteVisuals.current = arpNoteVisuals.current.filter(vis => {
                const grad = ctx.createLinearGradient(vis.x, canvas.height, vis.x, canvas.height - vis.height);
                grad.addColorStop(0, `rgba(${cc.primary[0]}, ${cc.primary[1]}, ${cc.primary[2]}, ${vis.alpha * 0.5})`);
                grad.addColorStop(1, `rgba(${cc.primary[0]}, ${cc.primary[1]}, ${cc.primary[2]}, 0)`);
                
                ctx.fillStyle = grad;
                ctx.fillRect(vis.x - 2, canvas.height - vis.height, 4, vis.height);

                // Animate
                vis.height += (canvas.height * 0.6 - vis.height) * 0.3; // Grow quickly
                vis.alpha -= 0.02; // Fade out

                return vis.alpha > 0; // Keep if still visible
            });
            
            // --- Optimized Waveform Glow ---
            const path = new Path2D();
            const sliceWidth = canvas.clientWidth / bufferLength;
            let x = 0;
            path.moveTo(x, dataArray[0] / 128.0 * (canvas.clientHeight / 2));
            for (let i = 1; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0; const y = v * (canvas.clientHeight / 2);
                x += sliceWidth; path.lineTo(x, y);
            }
            path.lineTo(canvas.clientWidth, canvas.clientHeight / 2);

            // 1. Glow layer (wider, semi-transparent)
            ctx.lineWidth = 5;
            ctx.strokeStyle = `rgba(${cc.primary[0]}, ${cc.primary[1]}, ${cc.primary[2]}, 0.3)`;
            ctx.stroke(path);

            // 2. Core layer (thinner, opaque)
            ctx.lineWidth = 2;
            ctx.strokeStyle = primaryColor;
            ctx.stroke(path);

            drawTouchFeedback(ctx, { primary: primaryColor });

            animationFrameId.current = requestAnimationFrame(draw);
        };
        draw();
        return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
    }, [activeColorScheme, particleDensity]);


    return (
        <div 
            className="relative flex-grow bg-black/50 backdrop-blur-md border border-white/10 rounded-lg flex flex-col items-center justify-center space-y-6 overflow-hidden"
            style={{ touchAction: 'none' }}
        >
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-0" />
            
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/50 p-2 flex items-center justify-center flex-wrap gap-4 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-gray-300">COLOR</label>
                    <select value={activeColorScheme} onChange={e => setActiveColorScheme(e.target.value)} className="bg-gray-800 border border-gray-600 rounded p-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500">
                        <option value="synthwavePink">Synthwave Pink</option>
                        <option value="cyberCyan">Cyber Cyan</option>
                        <option value="solarFlare">Solar Flare</option>
                    </select>
                </div>
                <div className="flex items-center gap-2 w-40">
                    <label className="text-xs font-bold text-gray-300">DENSITY</label>
                    <input type="range" min="0" max="100" value={particleDensity} onChange={e => setParticleDensity(parseInt(e.target.value, 10))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm" />
                </div>
                <button onClick={resetParticles} className="px-3 py-1 bg-gray-700 text-white font-bold rounded-md uppercase text-xs tracking-widest hover:bg-gray-600 transition-colors">
                    Clear
                </button>
            </div>

        </div>
    );
};

export default VisualizerCanvas;