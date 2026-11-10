import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { errorMessage } from '../utils/errors';
import { uploadImage } from './api';

export interface ImageItem {
  url: string;
  altText: string | null;
}

interface Pending {
  id: string;
  name: string;
  preview: string;
  progress: number;
  error?: string;
}

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Upload, preview, order and remove the images of one colourway. Files upload straight away (with
 * progress); the list is saved with the product. The first image is the primary image.
 */
export function ImageManager({
  images,
  onChange,
  colourName,
  max = 12,
}: {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
  colourName: string;
  max?: number;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const latest = useRef(images);
  useEffect(() => {
    latest.current = images;
  }, [images]);

  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    // Release preview URLs when the component goes away.
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const addFiles = (files: FileList | File[]) => {
    const room = max - latest.current.length - pending.filter((p) => !p.error).length;
    const selected = Array.from(files).slice(0, Math.max(0, room));
    for (const file of selected) {
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      const problem = !TYPES.includes(file.type)
        ? 'Only JPG, PNG or WebP images can be used.'
        : file.size > MAX_BYTES
          ? 'This image is larger than 5 MB.'
          : undefined;
      setPending((list) => [...list, { id, name: file.name, preview, progress: 0, error: problem }]);
      if (problem) continue;
      uploadImage(file, (progress) => setPending((list) => list.map((p) => (p.id === id ? { ...p, progress } : p))))
        .then((uploaded) => {
          // Several uploads can finish before the parent re-renders, so build on the latest list.
          const next = [...latest.current, { url: uploaded.url, altText: null }];
          latest.current = next;
          onChange(next);
          setPending((list) => list.filter((p) => p.id !== id));
          URL.revokeObjectURL(preview);
        })
        .catch((e: unknown) => setPending((list) => list.map((p) => (p.id === id ? { ...p, error: errorMessage(e) } : p))));
    }
  };

  const move = (index: number, delta: number) => {
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };

  const full = images.length >= max;

  return (
    <div className="ap-images">
      <ul className="ap-images__grid">
        {images.map((img, index) => (
          <li key={img.url} className={`ap-image${index === 0 ? ' is-primary' : ''}`}>
            <img src={img.url} alt={img.altText ?? `${colourName} image ${index + 1}`} />
            {index === 0 && <span className="ap-image__badge">Primary</span>}
            <div className="ap-image__tools">
              {index !== 0 && (
                <button type="button" className="ap-image__btn" onClick={() => move(index, -index)} aria-label="Make primary image" title="Make primary">
                  <Star size={15} />
                </button>
              )}
              <button type="button" className="ap-image__btn" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move left" title="Move left">
                <ArrowLeft size={15} />
              </button>
              <button
                type="button"
                className="ap-image__btn"
                onClick={() => move(index, 1)}
                disabled={index === images.length - 1}
                aria-label="Move right"
                title="Move right"
              >
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                className="ap-image__btn ap-image__btn--danger"
                onClick={() => onChange(images.filter((_, i) => i !== index))}
                aria-label="Remove image"
                title="Remove"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        ))}
        {pending.map((p) => (
          <li key={p.id} className={`ap-image is-pending${p.error ? ' has-error' : ''}`}>
            <img src={p.preview} alt="" />
            {p.error ? (
              <div className="ap-image__error" role="alert">
                <span>{p.error}</span>
                <button type="button" className="text-link" onClick={() => setPending((list) => list.filter((x) => x.id !== p.id))}>
                  Dismiss
                </button>
              </div>
            ) : (
              <div className="ap-image__progress" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${p.name}`}>
                <span style={{ width: `${p.progress}%` }} />
                <em>{p.progress}%</em>
              </div>
            )}
          </li>
        ))}
        {!full && (
          <li>
            <label
              htmlFor={inputId}
              className={`ap-dropzone${dragging ? ' is-dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
            >
              <ImagePlus size={26} aria-hidden="true" />
              <span>Add images</span>
              <small>JPG, PNG or WebP, up to 5 MB</small>
            </label>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="visually-hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </li>
        )}
      </ul>
      <p className="muted ap-small">
        {images.length} of {max} images. The first image is shown in the shop; use the star to change it.
      </p>
    </div>
  );
}
