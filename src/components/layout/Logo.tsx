import { Link } from 'react-router-dom';
import { brand } from '../../config/brand';

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link to="/" className={`logo${inverted ? ' logo--inverted' : ''}`} aria-label={`${brand.name} home`}>
      <svg className="logo__mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="var(--saffron)" />
        <path d="M9.5 23V9.5l13 13V9" fill="none" stroke="var(--ink)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="logo__word">{brand.name.toLowerCase()}</span>
      {/* Small original sneaker glyph beside the wordmark. */}
      <svg className="logo__shoe" viewBox="0 0 32 20" aria-hidden="true">
        <path
          d="M2.5 14.5C2.2 10.4 3 6.6 5 3.6c.5-.8 1.5-1 2.3-.5l2.4 1.6c1.6 1 3.6 1.2 5.3.4l.9-.4 1.4 2.6c3.8.5 8.4 1.8 10.9 4.2 1 .9 1.4 2 1.3 3H2.5z"
          fill="currentColor"
        />
        <path d="M11.5 6.6l1.4 2.2M14.4 6.3l1.4 2.2M17.2 6.6l1.3 2" stroke="var(--logo-shoe-detail)" strokeWidth="1.3" strokeLinecap="round" />
        <rect x="1.5" y="14.2" width="29" height="4" rx="2" fill="var(--saffron)" />
      </svg>
    </Link>
  );
}
