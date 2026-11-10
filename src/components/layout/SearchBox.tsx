import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { services } from '../../services';
import type { Product } from '../../types';
import { formatPrice } from '../../utils/format';
import { sizedImage } from '../../utils/images';

/** Header search with debounced product suggestions (combobox pattern). */
export function SearchBox({ autoFocus, onNavigate }: { autoFocus?: boolean; onNavigate?: () => void }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const navigate = useNavigate();
  const listId = useId();
  const wrapRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) return;
    let live = true;
    const t = window.setTimeout(() => {
      services.products.searchProducts({ search: q, pageSize: 5, sort: 'popular' }).then((r) => {
        if (live) {
          setResults(r.items.slice(0, 5));
          setActive(-1);
        }
      });
    }, 200);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [term]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const finish = () => {
    setOpen(false);
    setTerm('');
    onNavigate?.();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (active >= 0 && results[active]) {
      navigate(`/product/${results[active].slug}`);
    } else {
      const q = term.trim();
      navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
    }
    finish();
  };

  const showList = open && term.trim().length >= 2;
  const visible = showList ? results : [];

  return (
    <form ref={wrapRef} className="search" role="search" onSubmit={submit}>
      <label htmlFor={`${listId}-input`} className="visually-hidden">
        Search shoes and brands
      </label>
      <Search className="search__icon" size={18} aria-hidden="true" />
      <input
        id={`${listId}-input`}
        className="search__input"
        type="search"
        placeholder="Search shoes, brands, colours"
        value={term}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(-1, a - 1));
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {term && (
        <button type="button" className="search__clear" aria-label="Clear search" onClick={() => setTerm('')}>
          <X size={16} />
        </button>
      )}
      {showList && (
        <div className="search__panel">
          <ul id={listId} role="listbox" aria-label="Suggested products">
            {visible.map((p, i) => (
              <li key={p.id} id={`${listId}-opt-${i}`} role="option" aria-selected={i === active}>
                <Link to={`/product/${p.slug}`} className={`search__result${i === active ? ' is-active' : ''}`} onClick={finish}>
                  <img src={sizedImage(p.colours[0].images[0], 112)} alt="" />
                  <span>
                    <span className="search__result-name">{p.name}</span>
                    <span className="search__result-meta">
                      {p.brand}, {formatPrice(p.price)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {visible.length === 0 && <p className="search__empty">No shoes match “{term.trim()}”. Press Enter to see all results.</p>}
          <button type="submit" className="search__all">
            See all results for “{term.trim()}”
          </button>
        </div>
      )}
    </form>
  );
}
