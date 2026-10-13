import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ChevronDown, ChevronUp, Send } from 'lucide-react';

interface HelpSupportModalProps {
  open: boolean;
  onClose: () => void;
}

const inputClass = 'w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30';

const faqs = [
  {
    q: 'How do I add a new customer?',
    a: 'Go to the Customers page and click the "Add Customer" button at the top right. Fill in the customer details and click Save.',
  },
  {
    q: 'How do I create a new order?',
    a: 'Navigate to the Orders page and click "New Order". Select a customer, enter the order title, description, priority, and due date, then save.',
  },
  {
    q: 'How do I record a payment?',
    a: 'Go to the Payments page and click "Record Payment". Select the customer and order, enter the amount and payment method, then save.',
  },
  {
    q: 'How do I check low stock items?',
    a: 'The Dashboard shows items below their reorder level in the Low Stock section. You can also check the Inventory page for full stock details.',
  },
  {
    q: 'How do I update my workshop details?',
    a: 'Click on your profile in the top right corner and select "Workshop Settings" to update your workshop name, address, phone, email, and working hours.',
  },
];

export function HelpSupportModal({ open, onClose }: HelpSupportModalProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleClose() {
    setSubject('');
    setMessage('');
    setError(null);
    setSubmitted(false);
    setOpenFaq(0);
    onClose();
  }

  async function handleSubmit() {
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in both the subject and message.');
      return;
    }
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from('support_requests').insert({
      subject: subject.trim(),
      message: message.trim(),
    });

    if (insertError) {
      setError('Could not submit your request. Please try again.');
      setSaving(false);
      return;
    }

    setSaving(false);
    setSubmitted(true);
    setSubject('');
    setMessage('');
    setTimeout(() => handleClose(), 2000);
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Help & Support"
      maxWidth="max-w-xl"
      footer={
        submitted ? null : (
          <>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} loading={saving}>
              <Send className="h-4 w-4" /> Submit Request
            </Button>
          </>
        )
      }
    >
      {submitted ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <Send className="h-6 w-6" />
          </div>
          <p className="text-base font-medium text-steel-100">Request Submitted</p>
          <p className="text-sm text-steel-500">We'll get back to you as soon as possible.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* FAQs */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-steel-200">Frequently Asked Questions</h4>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={i} className="overflow-hidden rounded-lg border border-charcoal-700/40 bg-charcoal-800/40">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-steel-200 hover:bg-charcoal-700/30"
                  >
                    {faq.q}
                    {openFaq === i ? <ChevronUp className="h-4 w-4 shrink-0 text-steel-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-steel-400" />}
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-3 text-sm leading-relaxed text-steel-400">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Contact form */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-steel-200">Contact Support / Report a Problem</h4>
            {error && <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-steel-300">Subject</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} placeholder="Brief description of the issue" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-steel-300">Message</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className={inputClass} placeholder="Describe the problem or your question in detail…" />
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
