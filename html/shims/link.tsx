import type { AnchorHTMLAttributes, ReactNode } from "react";
import { navigate } from "../router";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode };

/** Stand-in for next/link: internal links switch the in-page route instead of loading a URL. */
export default function Link({ href, onClick, target: _target, ...rest }: Props) {
  void _target;
  const token = href.split("?")[0].replace(/^\//, "") || "overview";
  return (
    <a
      {...rest}
      href={`#${token}`}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        navigate(href);
      }}
    />
  );
}
