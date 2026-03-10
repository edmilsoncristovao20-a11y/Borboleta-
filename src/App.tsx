import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Dashboard from "./components/Dashboard";

export default function App() {
  const [isSplash, setIsSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-[#050508] text-white selection:bg-cyan-500/30">
      <AnimatePresence mode="wait">
        {isSplash ? (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050508]"
          >
            <div className="atmosphere" />
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="relative w-64 h-64 mb-8"
            >
              <img
                src="https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?auto=format&fit=crop&q=80&w=800&h=800"
                alt="Splash Butterfly"
                className="w-full h-full object-cover rounded-full blur-sm opacity-50"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ 
                    boxShadow: ["0 0 20px #00f2ff", "0 0 40px #00f2ff", "0 0 20px #00f2ff"],
                    scale: [1, 1.05, 1]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-32 h-32 rounded-full border-2 border-cyan-400/50 flex items-center justify-center bg-cyan-500/10"
                >
                  <span className="text-4xl font-serif italic text-cyan-400 neon-glow">B</span>
                </motion.div>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="text-center space-y-2"
            >
              <h1 className="text-4xl font-serif italic tracking-tight text-white/90">Borboleta VPN</h1>
              <p className="text-xs uppercase tracking-[0.5em] text-cyan-400/60 font-mono">Iniciando Túnel...</p>
            </motion.div>
          </motion.div>
        ) : (
          <Dashboard key="dashboard" />
        )}
      </AnimatePresence>
    </main>
  );
}
