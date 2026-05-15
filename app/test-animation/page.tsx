'use client';

import { motion } from 'framer-motion';

export default function TestAnimationPage() {
  const items = ['Premier', 'Deuxième', 'Troisième'];

  return (
    <main className="min-h-screen bg-[#111317] text-white font-sans p-8">
      <div className="max-w-2xl mx-auto space-y-12">
        <section>
          <p className="text-[11px] uppercase tracking-wider text-[#6b7280] mb-2">
            1. Fade in from below on mount
          </p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-head text-3xl font-bold uppercase tracking-tight"
          >
            Framer Motion Sandbox
          </motion.h1>
        </section>

        <section>
          <p className="text-[11px] uppercase tracking-wider text-[#6b7280] mb-2">
            2. whileTap scale to 0.95
          </p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="bg-[#E63946] text-white px-6 py-3 rounded font-bold uppercase tracking-wider"
          >
            Click me
          </motion.button>
        </section>

        <section>
          <p className="text-[11px] uppercase tracking-wider text-[#6b7280] mb-2">
            3. whileHover scale to 1.05
          </p>
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-[#1A1D24] border border-[#2D3748] rounded-lg p-6 max-w-sm cursor-pointer"
          >
            <p className="text-white font-bold">Hover this card</p>
            <p className="text-[#9CA3AF] text-sm mt-1">It scales up smoothly.</p>
          </motion.div>
        </section>

        <section>
          <p className="text-[11px] uppercase tracking-wider text-[#6b7280] mb-2">
            4. Stagger fade-in (200ms apart)
          </p>
          <ul className="space-y-2">
            {items.map((label, i) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.2, duration: 0.4 }}
                className="bg-[#1A1D24] border border-[#2D3748] rounded px-4 py-2"
              >
                {label}
              </motion.li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
