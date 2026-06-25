import type { ReactElement } from "react";
import type { InvestmentBullet } from "@/content/sections";
import styles from "./Card.module.css";

/**
 * Bullet list shared across the list cards. Accepts plain strings or parent
 * bullets with indented sub-bullets. Bullet text reads lighter (primary);
 * sub-bullets read gray (secondary).
 */
export function CardBulletList({
  items,
}: {
  items: readonly InvestmentBullet[];
}): ReactElement {
  return (
    <ul className={styles.bullets}>
      {items.map((item) => {
        if (typeof item === "string") {
          return <li key={item}>{item}</li>;
        }
        return (
          <li key={item.text}>
            {item.text}
            <ul className={styles.subBullets}>
              {item.subBullets.map((sub) => (
                <li key={sub}>{sub}</li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
