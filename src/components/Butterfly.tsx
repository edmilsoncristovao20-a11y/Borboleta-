import { motion } from "motion/react";
import { cn } from "../lib/utils";

interface ButterflyProps {
  isConnecting: boolean;
  isConnected: boolean;
  isEstablishing?: boolean;
  imageUrl?: string | null;
  className?: string;
}

export function Butterfly({ isConnecting, isConnected, isEstablishing, imageUrl, className }: ButterflyProps) {
  const defaultImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuDbMtm0FbqD6Cg9cyYmtR23-KYSKKJqb0HTWc1UROWt-YVlVfDnJkt0m07k5swpkbjs-stqBipRZdN6WUObKqrM59F3jzRZp3Mx3chX6P-QnvNYcyFPaBFSUxXvqnnv8FHmx18b7fl2AH1jAWCXdz9tCv_EaEG3NQ4jQFk1gmcE4eJa75wixukiDXVhnC3H65fXqeez2tEB9-QyIsbt-090H-P8Y2tUUZ-kPow2UFTtGPz-ZOdCL-x9R4NY2upxe3ZOGB7KlM16nA";
  const displayImage = imageUrl || defaultImage;

  return (
    <div className={cn("relative w-64 h-64 flex items-center justify-center perspective-1000", className)}>
      {/* Glow effect */}
      <motion.div
        animate={{
          scale: isConnected ? [1, 1.1, 1] : isEstablishing ? [1, 1.3, 1] : 1,
          opacity: isConnected ? [0.4, 0.7, 0.4] : isEstablishing ? [0.2, 0.8, 0.2] : 0.2,
          filter: isConnected ? "blur(40px)" : isEstablishing ? "blur(50px)" : "blur(30px)",
        }}
        transition={{ 
          duration: isEstablishing ? 0.3 : 3, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute inset-0 bg-cyan-500 rounded-full opacity-20"
      />

      {/* Butterfly Wings Animation */}
      <motion.div
        className="relative w-full h-full flex items-center justify-center preserve-3d"
        animate={{
          rotateY: isEstablishing ? [0, 20, 0] : isConnecting ? [0, 10, 0] : isConnected ? [0, 5, 0] : 0,
          y: isConnected ? [0, -15, 0] : isEstablishing ? [0, -5, 0] : 0,
          scale: isConnected ? [1, 1.02, 1] : 1,
        }}
        transition={{
          rotateY: { duration: isEstablishing ? 0.2 : isConnecting ? 0.5 : 4, repeat: Infinity, ease: "easeInOut" },
          y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
          scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
        }}
      >
        <div className="relative w-48 h-48 preserve-3d">
          {/* Left Wing */}
          <motion.div
            className="absolute left-0 top-0 w-1/2 h-full overflow-hidden"
            style={{ originX: "100%" }}
            animate={{
              rotateY: isEstablishing ? [0, -75, 0] : isConnecting ? [0, -45, 0] : isConnected ? [0, -10, 0] : 0,
            }}
            transition={{
              duration: isEstablishing ? 0.15 : isConnecting ? 0.4 : 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <img
              src={displayImage}
              alt="Butterfly Left"
              className="w-[200%] h-full object-cover shadow-2xl"
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }}
              referrerPolicy="no-referrer"
            />
          </motion.div>

          {/* Right Wing */}
          <motion.div
            className="absolute right-0 top-0 w-1/2 h-full overflow-hidden"
            style={{ originX: "0%" }}
            animate={{
              rotateY: isEstablishing ? [0, 75, 0] : isConnecting ? [0, 45, 0] : isConnected ? [0, 10, 0] : 0,
            }}
            transition={{
              duration: isEstablishing ? 0.15 : isConnecting ? 0.4 : 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <img
              src={displayImage}
              alt="Butterfly Right"
              className="w-[200%] h-full object-cover -translate-x-1/2 shadow-2xl"
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }}
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
