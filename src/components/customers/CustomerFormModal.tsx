import { useEffect } from 'react';
import type { Customer } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { FormField, FormInput, FormTextarea } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { Phone, MessageCircle, Mail, MapPin } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().optional(),
  email: z.string().email('Invalid email format').or(z.literal('')),
  phone: z.string().optional(),
  whatsapp_number: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

const emptyValues: CustomerFormValues = {
  name: '',
  company: '',
  email: '',
  phone: '',
  whatsapp_number: '',
  address: '',
  city: '',
  notes: '',
};

interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (values: CustomerFormValues) => Promise<void>;
  editing: Customer | null;
  saving: boolean;
}

export function CustomerFormModal({ open, onClose, onSave, editing, saving }: CustomerFormModalProps) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) {
      if (editing) {
        reset({
          name: editing.name,
          company: editing.company ?? '',
          email: editing.email ?? '',
          phone: editing.phone ?? '',
          whatsapp_number: editing.whatsapp_number ?? '',
          address: editing.address ?? '',
          city: editing.city ?? '',
          notes: editing.notes ?? '',
        });
      } else {
        reset(emptyValues);
      }
    }
  }, [open, editing, reset]);

  async function handleFormSubmit(data: CustomerFormValues) {
    await onSave(data);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Customer' : 'Add Customer'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="customer-form" loading={saving}>
            {editing ? 'Save Changes' : 'Add Customer'}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <FormField label="Full Name" required error={errors.name?.message}>
          <FormInput
            type="text"
            placeholder="John Smith"
            {...register('name')}
          />
        </FormField>
        <FormField label="Company" error={errors.company?.message}>
          <FormInput
            type="text"
            placeholder="Smith Steel Co"
            {...register('company')}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Email" error={errors.email?.message}>
            <FormInput
              type="email"
              icon={Mail}
              placeholder="john@smith.com"
              {...register('email')}
            />
          </FormField>
          <FormField label="Phone Number" error={errors.phone?.message}>
            <FormInput
              type="text"
              icon={Phone}
              placeholder="555-0100"
              {...register('phone')}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="WhatsApp Number" error={errors.whatsapp_number?.message}>
            <FormInput
              type="text"
              icon={MessageCircle}
              placeholder="555-0100"
              {...register('whatsapp_number')}
            />
          </FormField>
          <FormField label="City" error={errors.city?.message}>
            <FormInput
              type="text"
              placeholder="Pittsburgh"
              {...register('city')}
            />
          </FormField>
        </div>
        <FormField label="Address" error={errors.address?.message}>
          <FormInput
            type="text"
            icon={MapPin}
            placeholder="123 Industrial Way"
            {...register('address')}
          />
        </FormField>
        <FormField label="Notes" error={errors.notes?.message}>
          <FormTextarea
            rows={2}
            placeholder="Special requirements, payment terms, etc."
            {...register('notes')}
          />
        </FormField>
      </form>
    </Modal>
  );
}
