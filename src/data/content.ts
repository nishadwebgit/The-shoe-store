/** Static site content used in both modes: size guide and FAQs. */
export const sizeGuide = {
  adult: {
    headers: ['UK', 'US men', 'US women', 'EU', 'Foot length (cm)'],
    rows: [
      ['3', '3.5', '5', '35.5', '22.0'],
      ['4', '4.5', '6', '37', '22.9'],
      ['5', '5.5', '7', '38', '23.7'],
      ['6', '6.5', '8', '39', '24.6'],
      ['7', '7.5', '9', '40.5', '25.4'],
      ['8', '8.5', '10', '42', '26.2'],
      ['9', '9.5', '11', '43', '27.1'],
      ['10', '10.5', '12', '44.5', '27.9'],
      ['11', '11.5', '13', '45.5', '28.8'],
      ['12', '12.5', '14', '47', '29.6'],
    ],
  },
  kids: {
    headers: ['UK', 'US', 'EU', 'Age (approx.)', 'Foot length (cm)'],
    rows: [
      ['10K', '10.5', '28', '4–5 years', '17.1'],
      ['11K', '11.5', '29', '5–6 years', '18.0'],
      ['12K', '12.5', '30.5', '6–7 years', '18.8'],
      ['13K', '13.5', '32', '7–8 years', '19.7'],
      ['1K', '1.5', '33', '8–9 years', '20.5'],
      ['2K', '2.5', '34', '9–10 years', '21.4'],
    ],
  },
};

export const faqs: { question: string; answer: string; group: string }[] = [
  { group: 'Orders & delivery', question: 'How long does delivery take?', answer: 'Standard island-wide delivery takes 3–5 business days. Express delivery to Colombo, Gampaha and Kalutara districts takes 1–2 business days. You see an estimated delivery date before you place your order.' },
  { group: 'Orders & delivery', question: 'Is delivery free?', answer: 'Standard delivery is free on orders over LKR 25,000. Below that it costs LKR 450. Express delivery costs LKR 1,200, and collecting from our Ward Place store is always free.' },
  { group: 'Orders & delivery', question: 'Can I change my order after placing it?', answer: 'Contact us within two hours of ordering and we can change sizes, colours or the delivery address before the order is packed.' },
  { group: 'Sizing', question: 'How do I find my size?', answer: 'Open the size guide on any product page. Measure your foot from heel to longest toe in centimetres and match it to the foot length column. Product pages also tell you if a shoe runs small or large.' },
  { group: 'Sizing', question: 'What if the size is wrong?', answer: 'Exchanges for a different size are free within 30 days, as long as the shoes are unworn outdoors and in their original box.' },
  { group: 'Returns', question: 'What is your returns policy?', answer: 'You can return unworn shoes within 30 days for a full refund. Start a return from your order history or contact our care team.' },
  { group: 'Returns', question: 'When will I get my refund?', answer: 'We refund to the original payment method within 5 business days of receiving your return.' },
  { group: 'Payments', question: 'Which payment methods do you accept?', answer: 'The live store will accept Visa, Mastercard, Amex, LankaQR and cash on delivery. This demo site does not take real payments; checkout is simulated.' },
  { group: 'Account', question: 'Do I need an account to order?', answer: 'No. Guest checkout is available. An account lets you track orders, save your shoe size and see your order history.' },
];
