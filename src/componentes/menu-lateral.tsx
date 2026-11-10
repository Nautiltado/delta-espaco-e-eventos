"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ItemMenu } from "@/lib/permissoes";

export function MenuLateral({ itens }: { itens: ItemMenu[] }) {
  const caminho = usePathname();
  return (
    <ul className="menu">
      {itens.map((item) => {
        if (item.fase) {
          return (
            <li key={item.href}>
              <span className="futuro" title={`Chega na Fase ${item.fase}`}>
                {item.rotulo} <small>Fase {item.fase}</small>
              </span>
            </li>
          );
        }
        const ativo = item.href === "/" ? caminho === "/" : caminho.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link href={item.href} aria-current={ativo ? "page" : undefined}>
              {item.rotulo}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
