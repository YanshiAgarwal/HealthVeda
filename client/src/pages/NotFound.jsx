import { Link } from "react-router-dom";
import { Leaf } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-content-center px-4 text-center">
      <Leaf className="mx-auto text-leaf-300" size={56} />
      <h1 className="mt-4 font-display text-4xl font-bold text-leaf-900 dark:text-leaf-50">Page not found</h1>
      <p className="mt-2">This path has wandered off. Let's get you back in balance.</p>
      <Link to="/" className="btn-primary mx-auto mt-6">Go home</Link>
    </div>
  );
}
