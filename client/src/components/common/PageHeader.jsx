import { motion } from "framer-motion";

/** The big title block at the top of each page. */
export default function PageHeader({ icon: Icon, eyebrow, title, subtitle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="no-print mx-auto mb-10 max-w-2xl text-center"
    >
      {Icon && (
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-leaf-100 text-leaf-700 dark:bg-leaf-900 dark:text-leaf-200">
          <Icon size={28} />
        </span>
      )}
      {eyebrow && (
        <p className="mb-2 text-sm font-bold uppercase tracking-widest text-saffron-500">{eyebrow}</p>
      )}
      <h1 className="section-title">{title}</h1>
      {subtitle && <p className="mt-3 text-lg">{subtitle}</p>}
    </motion.div>
  );
}
