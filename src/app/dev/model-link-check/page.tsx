import { Icon } from "@/features/data-room/icons";
import styles from "@/features/data-room/Summary.module.css";

export default function Page() {
  return (
    <main style={{ maxWidth: 520, margin: "40px auto" }}>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.heading}>Economics</h2>
          <a href="/compute-model" target="_blank" rel="noopener noreferrer" className={styles.modelLink} id="model">
            Compute model
            <Icon name="external" />
          </a>
        </div>
        <p className={styles.lede}>Buys the site for $9.8M and converts it in 8 months.</p>
      </section>
    </main>
  );
}
