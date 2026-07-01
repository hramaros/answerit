import Image from "next/image";
import Link from "next/link";

// Marque valio réutilisable : logo optimisé (next/image) + wordmark.
// `as="span"` pour une version non cliquable ; sinon lien vers l'accueil.
export default function Brand({ as }) {
  const content = (
    <>
      <Image
        src="/logo.png"
        alt="valio"
        width={83}
        height={34}
        priority
        className="brand__logo"
      />
      <b>.fanontaniana</b>
    </>
  );
  if (as === "span") return <span className="brand">{content}</span>;
  return (
    <Link href="/" className="brand">
      {content}
    </Link>
  );
}
