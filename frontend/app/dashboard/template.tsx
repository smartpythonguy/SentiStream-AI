"use client";

/**
 * app/results/template.tsx  (or app/dashboard/template.tsx)
 * Place this alongside your results/dashboard page.tsx.
 * Next.js re-mounts this on every navigation, so the entry animation fires fresh each time.
 */

import { ReactNode } from "react";
import { motion } from "framer-motion";

export default function ResultsTemplate({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ minHeight: "100vh" }}
    >
      {children}
    </motion.div>
  );
}
