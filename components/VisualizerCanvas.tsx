import React, { useRef, useEffect, useState, useCallback } from 'react';
import { KnobState } from '../types';
import { audioService } from '../services/audioService';

interface VisualizerCanvasProps {
  knobs: KnobState[];
}

const colorSchemes = {
    synthwavePink: { primary: '#ec4899', shadow: '#ec4899', particle: 'rgba(236, 72, 153, 0.7)', grid: 'rgba(236, 72, 153, 0.2)' },
    cyberCyan: { primary: '#06b6d4', shadow: '#06b6d4', particle: 'rgba(6, 182, 212, 0.7)', grid: 'rgba(6, 182, 212, 0.2)' },
    solarFlare: { primary: '#f59e0b', shadow: '#f59e0b', particle: 'rgba(245, 158, 11, 0.7)', grid: 'rgba(245, 158, 11, 0.2)' },
};

interface Particle {
    x: number;
    y: number;
    size: number;
    baseSize: number;
    speedX: number;
    speedY: number;
}


const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({ knobs }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const mousePosition = useRef<{ x: number | null, y: number | null }>({ x: null, y: null });
    const gridOffset = useRef(0);
    const isDragging = useRef(false);
    const activeTouches = useRef(new Map<number, { x: number, y: number }>());
    
    const [colorScheme, setColorScheme] = useState('synthwavePink');
    const [particleDensity, setParticleDensity] = useState(50);

    const initParticles = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        particlesRef.current = [];
        const numberOfParticles = (canvas.clientWidth * canvas.clientHeight / 10000) * (particleDensity / 100);
        for (let i = 0; i < numberOfParticles; i++) {
            const baseSize = Math.random() * 2 + 1;
            particlesRef.current.push({
                x: Math.random() * canvas.clientWidth,
                y: Math.random() * canvas.clientHeight,
                size: baseSize,
                baseSize: baseSize,
                speedX: Math.random() * 1 - 0.5,
                speedY: Math.random() * 1 - 0.5,
            });
        }
    }, [particleDensity]);

    const returnToKnobValues = useCallback(() => {
        const cutoffKnob = knobs.find(k => k.id === 5)?.value ?? 80;
        const resKnob = knobs.find(k => k.id === 6)?.value ?? 20;
        const fxKnob = knobs.find(k => k.id === 4)?.value ?? 40;

        audioService.setFilterCutoff(cutoffKnob);
        audioService.setFilterResonance(resKnob);
        audioService.setFxDepth(fxKnob);
    }, [knobs]);

    const updateFilterFromPoint = useCallback((x: number, y: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const cutoff = (x / canvas.clientWidth) * 100;
        const resonance = (1 - (y / canvas.clientHeight)) * 100;

        audioService.setFilterCutoff(Math.max(0, Math.min(100, cutoff)));
        audioService.setFilterResonance(Math.max(0, Math.min(100, resonance)));
    }, []);

    const handleTouchUpdate = useCallback(() => {
        const touches = Array.from(activeTouches.current.values());
        const canvas = canvasRef.current;
        if (!canvas || touches.length === 0) return;

        const avg = touches.reduce((acc, t) => ({ x: acc.x + t.x, y: acc.y + t.y }), { x: 0, y: 0 });
        avg.x /= touches.length;
        avg.y /= touches.length;

        updateFilterFromPoint(avg.x, avg.y);

        if (touches.length >= 2) {
            const [t1, t2] = touches;
            const dx = t1.x - t2.x;
            const dy = t1.y - t2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxDistance = Math.sqrt(Math.pow(canvas.clientWidth, 2) + Math.pow(canvas.clientHeight, 2));
            const fxDepth = (distance / (maxDistance * 0.75)) * 100;
            audioService.setFxDepth(Math.max(0, Math.min(100, fxDepth)));
        } else if (touches.length === 1) {
            // Revert FX depth to knob value when pinch ends but one finger remains
            const fxKnob = knobs.find(k => k.id === 4)?.value ?? 40;
            audioService.setFxDepth(fxKnob);
        }
    }, [updateFilterFromPoint, knobs]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleResize = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.scale(dpr, dpr);
            initParticles();
        };

        const onTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            for (const touch of Array.from(e.changedTouches)) {
                activeTouches.current.set(touch.identifier, { x: touch.clientX - rect.left, y: touch.clientY - rect.top });
            }
            handleTouchUpdate();
        };
        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            for (const touch of Array.from(e.changedTouches)) {
                if (activeTouches.current.has(touch.identifier)) {
                    activeTouches.current.set(touch.identifier, { x: touch.clientX - rect.left, y: touch.clientY - rect.top });
                }
            }
            handleTouchUpdate();
        };
        const onTouchEnd = (e: TouchEvent) => {
            e.preventDefault();
            for (const touch of Array.from(e.changedTouches)) {
                activeTouches.current.delete(touch.identifier);
            }
            if (activeTouches.current.size === 0) {
                returnToKnobValues();
            } else {
                handleTouchUpdate();
            }
        };

        const handleMouseMove = (event: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            mousePosition.current = { x, y };
            if (isDragging.current) {
                updateFilterFromPoint(x, y);
            }
        };
        const handleMouseDown = (event: MouseEvent) => {
            if (event.button !== 0) return;
            isDragging.current = true;
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            updateFilterFromPoint(x, y);
        };
        const handleMouseUp = () => {
            if (isDragging.current) {
                isDragging.current = false;
                returnToKnobValues();
            }
        };
        const handleMouseLeave = () => {
            mousePosition.current = { x: null, y: null };
            if (isDragging.current) {
                isDragging.current = false;
                returnToKnobValues();
            }
        };
        
        window.addEventListener('resize', handleResize);
        handleResize();
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            window.removeEventListener('resize', handleResize);
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
            canvas.removeEventListener('touchcancel', onTouchEnd);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [initParticles, handleTouchUpdate, returnToKnobValues, updateFilterFromPoint]);

    const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, color: string) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        const horizon = height * 0.4;
        const vanishingPointX = width / 2;
        const gridSize = 50;
        for (let i = 0; i < 10; i++) {
            const perspectiveY = (gridOffset.current + i * gridSize) % (gridSize * 10);
            const screenY = horizon + Math.pow(perspectiveY / (gridSize * 10), 2) * (height - horizon);
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(width, screenY);
            ctx.stroke();
        }
        const numVerticalLines = 20;
        for (let i = -numVerticalLines; i <= numVerticalLines; i++) {
            const x = vanishingPointX + i * gridSize * 2;
            ctx.beginPath();
            ctx.moveTo(vanishingPointX, horizon);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        ctx.restore();
    };
    
    const drawInteractionFeedback = (ctx: CanvasRenderingContext2D, scheme: any, width: number, height: number) => {
        const touches = Array.from(activeTouches.current.values());
        
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = scheme.shadow;

        let interactionPoint: {x: number, y: number} | null = null;
        if (touches.length > 0) {
            const avg = touches.reduce((acc, t) => ({ x: acc.x + t.x, y: acc.y + t.y }), { x: 0, y: 0 });
            avg.x /= touches.length;
            avg.y /= touches.length;
            interactionPoint = avg;
        } else if (isDragging.current && mousePosition.current.x !== null && mousePosition.current.y !== null) {
            interactionPoint = mousePosition.current;
        }

        if (interactionPoint) {
            ctx.beginPath();
            ctx.arc(interactionPoint.x, interactionPoint.y, 15, 0, Math.PI * 2);
            ctx.strokeStyle = scheme.primary;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(interactionPoint.x - 20, interactionPoint.y);
            ctx.lineTo(interactionPoint.x + 20, interactionPoint.y);
            ctx.moveTo(interactionPoint.x, interactionPoint.y - 20);
            ctx.lineTo(interactionPoint.x, interactionPoint.y + 20);
            ctx.strokeStyle = `${scheme.primary}99`;
            ctx.lineWidth = 1;
            ctx.stroke();

            const cutoff = Math.round((interactionPoint.x / width) * 100);
            const resonance = Math.round((1 - (interactionPoint.y / height)) * 100);
            ctx.font = '12px Orbitron, sans-serif';
            ctx.fillStyle = `${scheme.primary}cc`;
            ctx.textAlign = 'left';
            ctx.fillText(`Cutoff: ${cutoff}%`, interactionPoint.x + 25, interactionPoint.y);
            ctx.fillText(`Reso: ${resonance}%`, interactionPoint.x + 25, interactionPoint.y + 15);
        }

        if (touches.length >= 2) {
            const [t1, t2] = touches;
            ctx.beginPath();
            ctx.moveTo(t1.x, t1.y);
            ctx.lineTo(t2.x, t2.y);
            ctx.strokeStyle = scheme.primary;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            const dx = t1.x - t2.x;
            const dy = t1.y - t2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxDistance = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
            const fxDepth = Math.round(Math.min(100, (distance / (maxDistance * 0.75)) * 100));

            const midX = (t1.x + t2.x) / 2;
            const midY = (t1.y + t2.y) / 2;
            ctx.font = '14px Orbitron, sans-serif';
            ctx.fillStyle = scheme.primary;
            ctx.textAlign = 'center';
            ctx.fillText(`FX Depth: ${fxDepth}%`, midX, midY - 15);
        }
        ctx.restore();
    };

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
            const dpr = window.devicePixelRatio || 1;
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;

            ctx.clearRect(0, 0, width * dpr, height * dpr);
            ctx.save();
            ctx.scale(dpr,dpr);

            const scheme = colorSchemes[colorScheme as keyof typeof colorSchemes];
            
            gridOffset.current = (gridOffset.current + 0.2) % 500;
            drawGrid(ctx, width, height, scheme.grid);

            analyser.getByteTimeDomainData(dataArray);

            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0 - 1.0;
                sum += v * v;
            }
            const rms = Math.sqrt(sum / bufferLength);
            const volume = Math.min(rms * 5, 1);
            const sizeMultiplier = 1 + volume * 2.5;

            ctx.fillStyle = scheme.particle;
            particlesRef.current.forEach(p => {
                if (mousePosition.current.x !== null && mousePosition.current.y !== null) {
                    const dx = mousePosition.current.x - p.x;
                    const dy = mousePosition.current.y - p.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance > 1) {
                        const forceMagnitude = 1 / Math.max(distance, 50);
                        const attractionForceX = dx * forceMagnitude * 0.15;
                        const attractionForceY = dy * forceMagnitude * 0.15;
                        const swirlForceX = -dy * forceMagnitude * 0.1;
                        const swirlForceY = dx * forceMagnitude * 0.1;
                        p.speedX += attractionForceX + swirlForceX;
                        p.speedY += attractionForceY + swirlForceY;
                    }
                }
                
                p.speedX *= 0.96;
                p.speedY *= 0.96;
                p.x += p.speedX;
                p.y += p.speedY;

                if (p.x > width + p.size) p.x = -p.size; else if (p.x < -p.size) p.x = width + p.size;
                if (p.y > height + p.size) p.y = -p.size; else if (p.y < -p.size) p.y = height + p.size;

                const targetSize = p.baseSize * sizeMultiplier;
                p.size += (targetSize - p.size) * 0.1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.lineWidth = 2;
            ctx.strokeStyle = scheme.primary;
            ctx.shadowBlur = 10;
            ctx.shadowColor = scheme.shadow;
            ctx.beginPath();
            
            const sliceWidth = width / bufferLength;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * (height / 2);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.lineTo(width, height / 2);
            ctx.stroke();
            ctx.shadowBlur = 0;

            drawInteractionFeedback(ctx, scheme, width, height);

            ctx.restore();

            animationFrameId.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [colorScheme, particleDensity, initParticles]);


    return (
        <div 
            className="relative flex-grow bg-black/50 backdrop-blur-md border border-white/10 rounded-lg flex flex-col items-center justify-center space-y-6 overflow-hidden cursor-crosshair"
            style={{ touchAction: 'none' }}
        >
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-0" />
            
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/50 p-2 flex items-center justify-center flex-wrap gap-4 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-gray-300">COLOR</label>
                    <select value={colorScheme} onChange={e => setColorScheme(e.target.value)} className="bg-gray-800 border border-gray-600 rounded p-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500">
                        <option value="synthwavePink">Synthwave Pink</option>
                        <option value="cyberCyan">Cyber Cyan</option>
                        <option value="solarFlare">Solar Flare</option>
                    </select>
                </div>
                <div className="flex items-center gap-2 w-40">
                    <label className="text-xs font-bold text-gray-300">DENSITY</label>
                    <input type="range" min="0" max="100" value={particleDensity} onChange={e => setParticleDensity(parseInt(e.target.value, 10))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm" />
                </div>
                <button onClick={initParticles} className="px-3 py-1 bg-gray-700 text-white font-bold rounded-md uppercase text-xs tracking-widest hover:bg-gray-600 transition-colors">
                    Clear
                </button>
            </div>

        </div>
    );
};

export default VisualizerCanvas;
