import './guides.css';

// Premium guides shell: loads guides.css once and carries `.gvg`, where the
// stylesheet hangs its palette. Header and footer come from BlogChrome, which
// each page mounts, exactly like the blog.
export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return <div className="gvg">{children}</div>;
}
