import React, { useEffect, useState, useRef } from 'react';
import { Range } from 'react-range';
import { Play, Pause, ChevronRight } from 'lucide-react';

export default function TimelinePanel({ mapInstance, onPlayTimeline }) {
    const [events, setEvents] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const playInterval = useRef(null);

    // Fetch chronological timeline on mount
    useEffect(() => {
        async function fetchTimeline() {
            try {
                const res = await fetch('http://localhost:5001/api/timeline');
                const data = await res.json();
                setEvents(data);
            } catch (err) {
                console.error('Failed fetching timeline:', err);
            }
        }
        fetchTimeline();
    }, []);

    const togglePlay = () => {
        if (events.length === 0) return;

        if (isPlaying) {
            clearInterval(playInterval.current);
            setIsPlaying(false);
        } else {
            // If we are at the end, restart from 0
            if (currentIndex >= events.length - 1) {
                setCurrentIndex(0);
            }
            setIsPlaying(true);
            
            // Replay callback clears map markers externally in App.jsx
            if (currentIndex === 0 || currentIndex >= events.length - 1) {
                onPlayTimeline([]); 
            }

            playInterval.current = setInterval(() => {
                setCurrentIndex(prev => {
                    const next = prev + 1;
                    if (next >= events.length) {
                        clearInterval(playInterval.current);
                        setIsPlaying(false);
                        return prev;
                    }
                    
                    // Dispatch the event to the map renderer
                    const targetEvent = events[next];
                    onPlayTimeline(targetEvent);
                    
                    return next;
                });
            }, 800); // Wait 800ms between physical marker drops
        }
    };

    // Cleanup interval on unmount
    useEffect(() => {
        return () => clearInterval(playInterval.current);
    }, []);

    const handleJumpToEvent = (idx) => {
        setCurrentIndex(idx);
        const ev = events[idx];
        if (mapInstance && ev.lat && ev.lon) {
            mapInstance.flyTo({ center: [ev.lon, ev.lat], zoom: 14, speed: 1.2 });
        }
    };

    if (!events || events.length === 0) {
        return (
             <div className="h-48 glass-panel m-4 mt-0 p-5 flex items-center justify-center text-slate-500 italic">
                Awaiting historical events...
            </div>
        );
    }

    const currentEvent = events[currentIndex] || events[0];

    return (
        <div className="h-[220px] glass-panel m-4 mt-0 p-5 flex flex-col gap-4 border-t-2 border-t-blue-500/50 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20">
            
            {/* Top row: controls + range */}
            <div className="flex items-center gap-6">
                <button 
                    onClick={togglePlay}
                    className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center transition-colors shadow-lg shrink-0"
                >
                    {isPlaying ? <Pause size={24} fill="currentColor"/> : <Play size={24} fill="currentColor" className="ml-1"/>}
                </button>
                
                <div className="flex-1 px-4">
                    <Range
                        step={1}
                        min={0}
                        max={Math.max(0, events.length - 1)}
                        values={[currentIndex]}
                        onChange={(vals) => setCurrentIndex(vals[0])}
                        renderTrack={({ props, children }) => (
                            <div
                                {...props}
                                className="h-2 w-full bg-slate-800 rounded-full relative"
                            >
                                <div 
                                    className="absolute top-0 left-0 h-full bg-blue-500/50 rounded-l-full pointer-events-none"
                                    style={{ width: `${events.length > 1 ? (currentIndex / (events.length - 1)) * 100 : 0}%` }}
                                />
                                {children}
                            </div>
                        )}
                        renderThumb={({ props }) => (
                            <div
                                {...props}
                                className="w-5 h-5 bg-white shadow-lg rounded-full focus:outline-none focus:ring-4 focus:ring-blue-500/30 transition-shadow"
                            />
                        )}
                    />
                        <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono">
                            <span>{events[0]?.time ? new Date(events[0].time).toLocaleTimeString() : '--:--'}</span>
                            <span className="text-blue-400 font-bold">{currentEvent?.time ? new Date(currentEvent.time).toLocaleTimeString() : '--:--'}</span>
                            <span>{events[events.length - 1]?.time ? new Date(events[events.length - 1].time).toLocaleTimeString() : '--:--'}</span>
                        </div>
                </div>
            </div>

            {/* Bottom Row: Detailed Event Scroller */}
            <div className="flex-1 overflow-x-auto flex items-center gap-3 pb-2 custom-scrollbar">
                {events.map((ev, i) => (
                    <div 
                        key={i}
                        onClick={() => handleJumpToEvent(i)}
                        className={`
                            shrink-0 w-64 p-3 rounded-lg border transition-all cursor-pointer
                            ${i === currentIndex 
                                ? 'bg-blue-900/40 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                                : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-500 opacity-60'
                            }
                        `}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className={`text-xs font-bold uppercase tracking-wide ${i===currentIndex ? 'text-blue-400' : 'text-slate-400'}`}>
                                {ev.type}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                                {ev.time ? new Date(ev.time).toLocaleTimeString() : '--:--'}
                            </span>
                        </div>
                        <p className={`text-sm truncate ${i===currentIndex ? 'text-white' : 'text-slate-300'}`}>
                            {ev.description || "Location Report"}
                        </p>
                        <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1 group-hover:text-slate-400 transition-colors">
                           <ChevronRight size={10}/> [{ev.lat?.toFixed(3) || 0}, {ev.lon?.toFixed(3) || 0}]
                        </div>
                    </div>
                ))}
            </div>

        </div>
    );
}
