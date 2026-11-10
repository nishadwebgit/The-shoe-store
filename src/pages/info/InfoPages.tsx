import { useState, type FormEvent, type ReactNode } from 'react';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/Feedback';
import { SelectField, TextAreaField, TextField } from '../../components/ui/FormField';
import { appConfig, deliveryMethods } from '../../config/appConfig';
import { brand } from '../../config/brand';
import { faqs } from '../../data/content';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { services } from '../../services';
import { errorMessage } from '../../utils/errors';
import { formatPrice } from '../../utils/format';
import { email, hasErrors, minLength, required, validate } from '../../utils/validation';

const helpLinks = [
  { to: '/help/faq', label: 'FAQs' },
  { to: '/help/shipping', label: 'Shipping & delivery' },
  { to: '/help/returns', label: 'Returns & exchanges' },
  { to: '/contact', label: 'Contact us' },
  { to: '/legal/privacy', label: 'Privacy policy' },
  { to: '/legal/terms', label: 'Terms & conditions' },
];

function InfoLayout({ title, intro, updated, children }: { title: string; intro?: ReactNode; updated?: string; children: ReactNode }) {
  useDocumentTitle(title);
  return (
    <div className="container info">
      <div className="info__layout">
        <nav className="info__nav" aria-label="Help and policies">
          {helpLinks.map((l) => (
            <NavLink key={l.to} to={l.to}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <article className="info__content">
          <h1 className="page-title">{title}</h1>
          {intro && <p className="info__intro">{intro}</p>}
          {updated && <p className="muted info__updated">Last updated {updated}</p>}
          <div className="prose">{children}</div>
        </article>
      </div>
    </div>
  );
}

export function AboutPage() {
  useDocumentTitle('About us');
  return (
    <div className="about">
      <section className="about__hero">
        <div className="container">
          <h1 className="display about__title">We started with one shop on Ward Place and a lot of opinions about shoes.</h1>
        </div>
      </section>
      <div className="container about__body">
        <div className="prose">
          <p className="info__intro">
            Nishoes started in Colombo in 2019 because buying good running shoes here meant guessing your size
            from a photo, waiting weeks for an import, and hoping.
          </p>
          <h2>What we do differently</h2>
          <ul>
            <li>
              <strong>Fit first.</strong> Every product page tells you whether a shoe runs small or large, based on what customers tell us after
              they buy.
            </li>
            <li>
              <strong>Stock you can see.</strong> Sizes show as sold out the moment they are, so you never pick a size we can’t send.
            </li>
            <li>
              <strong>Made for the weather.</strong> We test pairs through monsoon season in Colombo and the hill country before we stock them.
            </li>
            <li>
              <strong>Local makers.</strong> Our loafers come from a Colombo workshop that has made shoes for three generations.
            </li>
          </ul>
          <h2>Visit us</h2>
          <p>
            {brand.address}. Open {brand.hours}. Bring your running shoes and we’ll look at how they’ve worn before recommending your next pair.
          </p>
        </div>
        <dl className="about__facts">
          <div>
            <dt>Pairs sent island-wide</dt>
            <dd>48,000+</dd>
          </div>
          <div>
            <dt>Districts delivered to</dt>
            <dd>All 25</dd>
          </div>
          <div>
            <dt>Saturday run club</dt>
            <dd>6.00 am, Galle Face</dd>
          </div>
        </dl>
      </div>
      <div className="container about__cta">
        <ButtonLink to="/shop">Shop all shoes</ButtonLink>
        <ButtonLink to="/contact" variant="secondary">
          Get in touch
        </ButtonLink>
      </div>
    </div>
  );
}

type ContactKeys = 'name' | 'email' | 'topic' | 'orderNumber' | 'message';

export function ContactPage() {
  const [form, setForm] = useState<Record<ContactKeys, string>>({ name: '', email: '', topic: '', orderNumber: '', message: '' });
  const [errors, setErrors] = useState<Partial<Record<ContactKeys, string>>>({});
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const set = (k: ContactKeys) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form, {
      name: [required('name')],
      email: [email],
      topic: [(v) => (v ? undefined : 'Choose what your message is about.')],
      orderNumber: [(v) => (!v || /^NS-\d{4}-\d{5}$/i.test(v.trim()) ? undefined : 'Order numbers look like NS-2611-12345.')],
      message: [minLength('message', 20)],
    });
    setErrors(found);
    if (hasErrors(found)) return;
    setBusy(true);
    try {
      const res = await services.engagement.sendContactMessage({ ...form, orderNumber: form.orderNumber || undefined });
      setReference(res.reference);
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <InfoLayout title="Contact us" intro="Questions about sizing, an order or a return? Our care team replies within one business day.">
      <ul className="contact-methods">
        <li>
          <Phone size={20} aria-hidden="true" />
          <span>
            <a href={`tel:${brand.phone.replace(/\s/g, '')}`}>{brand.phone}</a>
            <br />
            <span className="muted">{brand.hours}</span>
          </span>
        </li>
        <li>
          <MessageCircle size={20} aria-hidden="true" />
          <span>
            WhatsApp {brand.whatsapp}
            <br />
            <span className="muted">Fastest for sizing advice</span>
          </span>
        </li>
        <li>
          <Mail size={20} aria-hidden="true" />
          <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>
        </li>
        <li>
          <MapPin size={20} aria-hidden="true" />
          <span>{brand.address}</span>
        </li>
      </ul>

      {reference ? (
        <div className="alert alert--success" role="status">
          <p>
            <strong>Message sent.</strong> Your reference is {reference}. This is a demo, so no email was sent; in the live store we’d reply to{' '}
            {form.email} within one business day.
          </p>
        </div>
      ) : (
        <form className="contact-form" onSubmit={submit} noValidate>
          <h2>Send a message</h2>
          {failure && <ErrorState message={failure} />}
          <div className="form-grid">
            <TextField label="Your name" autoComplete="name" value={form.name} onChange={(e) => set('name')(e.target.value)} error={errors.name} />
            <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email')(e.target.value)} error={errors.email} />
            <SelectField label="Topic" value={form.topic} onChange={(e) => set('topic')(e.target.value)} error={errors.topic}>
              <option value="">Choose a topic</option>
              <option>Sizing advice</option>
              <option>An existing order</option>
              <option>Returns and exchanges</option>
              <option>Product question</option>
              <option>Something else</option>
            </SelectField>
            <TextField label="Order number" optional value={form.orderNumber} onChange={(e) => set('orderNumber')(e.target.value)} error={errors.orderNumber} hint="e.g. NS-2611-12345" />
            <div className="form-grid__full">
              <TextAreaField label="Message" rows={6} value={form.message} onChange={(e) => set('message')(e.target.value)} error={errors.message} />
            </div>
          </div>
          <Button type="submit" loading={busy}>
            Send message
          </Button>
        </form>
      )}
    </InfoLayout>
  );
}

export function FaqPage() {
  const groups = [...new Set(faqs.map((f) => f.group))];
  return (
    <InfoLayout title="Frequently asked questions" intro="Can’t find your answer? Contact our care team and we’ll help.">
      {groups.map((g) => (
        <section key={g} className="faq-group">
          <h2>{g}</h2>
          <div className="accordion">
            {faqs
              .filter((f) => f.group === g)
              .map((f) => (
                <details key={f.question}>
                  <summary>{f.question}</summary>
                  <div className="accordion__body">
                    <p>{f.answer}</p>
                  </div>
                </details>
              ))}
          </div>
        </section>
      ))}
      <p>
        Still stuck? <Link to="/contact">Contact us</Link>.
      </p>
    </InfoLayout>
  );
}

export function ShippingPage() {
  return (
    <InfoLayout title="Shipping and delivery" updated="1 October 2026" intro="We deliver to all 25 districts in Sri Lanka. You’ll see an estimated delivery date before you pay.">
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Delivery options">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Option</th>
              <th scope="col">Where</th>
              <th scope="col">Time</th>
              <th scope="col">Cost</th>
            </tr>
          </thead>
          <tbody>
            {deliveryMethods.map((m) => (
              <tr key={m.id}>
                <th scope="row">{m.label}</th>
                <td>{m.description}</td>
                <td>
                  {m.minBusinessDays === m.maxBusinessDays ? m.minBusinessDays : `${m.minBusinessDays}–${m.maxBusinessDays}`} business{' '}
                  {m.maxBusinessDays === 1 ? 'day' : 'days'}
                </td>
                <td>
                  {m.baseFee === 0 ? 'Free' : formatPrice(m.baseFee)}
                  {m.freeOverThreshold ? `, free over ${formatPrice(appConfig.shipping.freeShippingThreshold)}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Business days</h2>
      <p>Our couriers deliver Monday to Saturday, excluding public and Poya holidays. Orders placed after 2.00 pm are packed the next business day.</p>
      <h2>Tracking</h2>
      <p>You’ll get a tracking link by SMS and email when your order leaves our warehouse. Signed-in customers can also see order status in their account.</p>
      <h2>Missed deliveries</h2>
      <p>The courier will call before delivering and try twice. After that, your order returns to our Ward Place store for collection within 14 days.</p>
    </InfoLayout>
  );
}

export function ReturnsPage() {
  return (
    <InfoLayout title="Returns and exchanges" updated="1 October 2026" intro="Wrong size? Changed your mind? You have 30 days.">
      <h2>Free size exchanges</h2>
      <p>Exchange for a different size or colour of the same shoe within 30 days of delivery. We cover delivery both ways.</p>
      <h2>Returns for a refund</h2>
      <ul>
        <li>Shoes must be unworn outdoors, in their original box, with all tags attached.</li>
        <li>Start a return from your order or by contacting our care team with your order number.</li>
        <li>Drop the parcel at any partner courier office, or bring it to our Ward Place store.</li>
        <li>We refund to the original payment method within 5 business days of receiving your return.</li>
      </ul>
      <h2>Items we can’t take back</h2>
      <p>Worn shoes, shoes damaged by misuse, and gift cards. Faulty items are always covered: contact us within 6 months of purchase.</p>
    </InfoLayout>
  );
}

export function PrivacyPage() {
  return (
    <InfoLayout title="Privacy policy" updated="1 October 2026" intro={`How ${brand.legalName} collects and uses your information.`}>
      <h2>What we collect</h2>
      <p>Your name, contact details and delivery address when you order; your order history and saved preferences when you have an account; and basic, anonymised analytics about how the site is used.</p>
      <h2>How we use it</h2>
      <ul>
        <li>To process and deliver your orders and handle returns.</li>
        <li>To reply to your questions.</li>
        <li>To send marketing emails, only if you opt in. You can unsubscribe at any time.</li>
      </ul>
      <h2>Who we share it with</h2>
      <p>Only our courier partners and payment provider, and only what they need to complete your order. We never sell your data.</p>
      <h2>Your rights</h2>
      <p>
        Under Sri Lanka’s Personal Data Protection Act, you can ask to see, correct or delete your data. Email {brand.supportEmail}.
      </p>
      <h2>About this demo</h2>
      <p>
        Your account, bag, wishlist and orders are stored by the Nishoes API. Passwords are stored only as salted hashes, and you stay signed in
        with a secure cookie that page scripts can’t read. Guests’ wishlists and recently viewed items stay in this browser. Payments are simulated:
        no card details are collected.
      </p>
    </InfoLayout>
  );
}

export function TermsPage() {
  return (
    <InfoLayout title="Terms and conditions" updated="1 October 2026">
      <h2>Using this site</h2>
      <p>By placing an order you agree to these terms. You must be 18 or over, or have a parent or guardian’s permission, to order.</p>
      <h2>Prices and payment</h2>
      <p>Prices are in Sri Lankan rupees and include VAT. We check prices and stock when you place your order; if something has changed we’ll tell you before charging.</p>
      <h2>Orders</h2>
      <p>Your order is a request to buy. We accept it when we send your dispatch confirmation. We may cancel orders affected by pricing errors or stock problems, with a full refund.</p>
      <h2>Demonstration store</h2>
      <p>This website is a demonstration. Orders are simulated, no payments are processed and no goods will be delivered.</p>
      <h2>Contact</h2>
      <p>
        {brand.legalName}, {brand.address}. {brand.email}.
      </p>
    </InfoLayout>
  );
}

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="container not-found">
      <p className="not-found__code display" aria-hidden="true">
        404
      </p>
      <h1 className="page-title">This page has walked off</h1>
      <p className="muted">The link may be broken, or the page may have moved.</p>
      <div className="not-found__actions">
        <ButtonLink to="/">Go to the homepage</ButtonLink>
        <ButtonLink to="/shop" variant="secondary">
          Shop all shoes
        </ButtonLink>
      </div>
    </div>
  );
}
