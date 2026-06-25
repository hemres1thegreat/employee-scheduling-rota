/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Smartphone, RotateCw, Monitor, Battery, Wifi } from 'lucide-react';

interface IPhoneShellProps {
  children: React.ReactNode;
}

export default function IPhoneShell({ children }: IPhoneShellProps) {
  const [useDeviceFrame, setUseDeviceFrame] = useState(true);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const mobile = width < 768;
      setIsMobile(mobile);
      setIsPortrait(height > width && mobile);
    };

    checkViewport();
    window.addEventListener('resize', checkViewport);
    window.addEventListener('orientationchange', checkViewport);
    return () => {
      window.removeEventListener('resize', checkViewport);
      window.removeEventListener('orientationchange', checkViewport);
    };
  }, []);

  const showDeviceFrame = useDeviceFrame && !isMobile;

  return (
    <div className="min-h-[100dvh] bg-neutral-950 text-white flex flex-col items-center justify-center p-1 sm:p-2 font-sans overflow-x-hidden select-none">
      {isPortrait && (
        <div className="fixed inset-0 z-50 bg-neutral-900 flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mb-6 border border-orange-500/30 animate-pulse">
            <RotateCw className="w-10 h-10 text-orange-400" />
          </div>
          <h2 className="text-2xl font-bold font-sans tracking-tight mb-3">Please Rotate Your Device</h2>
          <p className="text-neutral-400 text-sm max-w-xs leading-relaxed">
            The Employee Scheduling Rota is optimized for landscape mode to give you the perfect high-density calendar experience.
          </p>
          <div className="mt-8 text-xs text-neutral-500 font-mono tracking-wider flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-orange-400" /> IOS LANDSCAPE VIEW
          </div>
        </div>
      )}

      <div className="hidden md:flex w-full max-w-5xl justify-between items-center mb-2 px-4 py-1.5 bg-neutral-900/60 rounded-xl border border-neutral-800/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <p className="text-xs font-medium text-neutral-300">
            iPhone Landscape Mode Active: <span className="text-emerald-400 font-mono text-xs">True HD Preview</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setUseDeviceFrame(true)}
            id="toggle-iphone-frame-active"
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border transition-all duration-200 ${
              useDeviceFrame
                ? 'bg-neutral-800 border-neutral-700 text-white shadow-inner font-semibold'
                : 'bg-transparent border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            iPhone Frame (Landscape)
          </button>
          <button
            onClick={() => setUseDeviceFrame(false)}
            id="toggle-fullscreen-frame"
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border transition-all duration-200 ${
              !useDeviceFrame
                ? 'bg-neutral-800 border-neutral-700 text-white shadow-inner font-semibold'
                : 'bg-transparent border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            Widescreen View
          </button>
        </div>
      </div>

      {showDeviceFrame ? (
        <div className="relative mx-auto my-3 transition-all duration-500 ease-in-out">
          <div className="relative bg-neutral-900 rounded-[56px] p-3 shadow-2xl border-4 border-neutral-800 shadow-neutral-950 flex items-center justify-center w-[840px] h-[395px] max-w-[95vw] md:max-w-none">
            <div className="absolute -left-1.5 top-20 w-1 h-8 bg-neutral-700 rounded-r-lg"></div>
            <div className="absolute -left-1.5 top-32 w-1 h-14 bg-neutral-700 rounded-r-lg"></div>
            <div className="absolute -left-1.5 top-48 w-1 h-14 bg-neutral-700 rounded-r-lg"></div>
            <div className="absolute -right-1.5 top-28 w-1 h-20 bg-neutral-700 rounded-l-lg"></div>

            <div className="relative w-full h-full bg-black rounded-[46px] overflow-hidden border-[6px] border-neutral-950 flex flex-col shadow-inner">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-24 bg-neutral-950 rounded-r-2xl z-40 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-900/40 border border-blue-500/20 mr-1"></div>
                <div className="w-1 h-6 rounded-full bg-[#0a0a0a]"></div>
              </div>

              <div className="h-6 px-12 pt-1 flex justify-between items-center text-[10px] font-sans font-semibold tracking-wide text-neutral-300 bg-neutral-950 select-none z-30">
                <div className="flex items-center gap-1.5">
                  <span>9:41</span>
                  <span className="text-neutral-500">·</span>
                  <span className="text-blue-400 font-bold text-[9px] bg-blue-400/10 px-1 py-0.5 rounded-md uppercase">Locked</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wifi className="w-3 h-3 text-neutral-300" />
                  <span className="text-neutral-400">5G</span>
                  <div className="flex items-center gap-0.5 bg-neutral-800 px-1 py-0.5 rounded text-[8px] font-mono border border-neutral-700 text-neutral-400">
                    <Battery className="w-3 h-3 text-emerald-400 mr-0.5" />
                    <span>88%</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative bg-[#000000] pb-2 text-neutral-100 flex flex-col min-h-0">
                {children}
              </div>

              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/40 rounded-full z-40 pointer-events-none"></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-7xl animate-fadeIn bg-[#000000] rounded-none sm:rounded-2xl border-0 sm:border border-neutral-800 overflow-hidden shadow-2xl min-h-[100dvh] sm:min-h-[580px] flex flex-col relative">
          <div className="flex-1 flex flex-col min-h-0">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
