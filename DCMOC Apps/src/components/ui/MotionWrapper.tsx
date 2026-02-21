
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const PageTransition = ({ children, className }: { children: React.ReactNode, className?: string }) => {
    return (
        <AnimatePresence mode="wait">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={className}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
};

export const CardMotion = ({ children, index = 0, className }: { children: React.ReactNode, index?: number, className?: string }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
            className={className}
        >
            {children}
        </motion.div>
    );
};
