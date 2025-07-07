// src/components/EditPatientResultDialog.tsx
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { PatientResult } from "@/types"; // Adjust path if needed
import { supabase } from "@/lib/supabaseClient"; // Adjust path if needed

// Define the Zod schema for validation (notes removed)
const formSchema = z.object({
  normal_price: z.coerce
    .number({ invalid_type_error: "Must be a number" })
    .min(0, "Price cannot be negative")
    .nullable(),
  insurance_price: z.coerce
    .number({ invalid_type_error: "Must be a number" })
    .min(0, "Price cannot be negative")
    .nullable(),
  unpaid_amount: z.coerce
    .number({ invalid_type_error: "Must be a number" })
    .min(0, "Amount cannot be negative")
    .nullable(),
});

type FormData = z.infer<typeof formSchema>;

interface EditPatientResultDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  patientResult: PatientResult | null;
  onUpdateSuccess: () => void; // Callback to trigger parent re-render
}

export function EditPatientResultDialog({
  open,
  setOpen,
  patientResult,
  onUpdateSuccess,
}: EditPatientResultDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      // notes removed from defaultValues
      normal_price: null,
      insurance_price: null,
      unpaid_amount: null,
    },
  });

  useEffect(() => {
    if (patientResult) {
      form.reset({
        // notes removed from reset
        normal_price: patientResult.normal_price,
        insurance_price: patientResult.insurance_price,
        unpaid_amount: patientResult.unpaid_amount,
      });
      setSubmitError(null);
    }
  }, [patientResult, open, form.reset]);

  const onSubmit = async (data: FormData) => {
    if (!patientResult) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { error } = await supabase
        .from("patient_result")
        .update({
          // notes removed from update payload
          normal_price: data.normal_price,
          insurance_price: data.insurance_price,
          unpaid_amount: data.unpaid_amount,
        })
        .eq("id", patientResult.id);

      if (error) {
        throw error;
      }

      onUpdateSuccess();
      setOpen(false);
      form.reset();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Error updating patient result:", error);
      setSubmitError(error.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
      setSubmitError(null);
    }
    setOpen(isOpen);
  };

  if (!patientResult) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit Patient Result</DialogTitle>
          <DialogDescription>
            Make changes to the patient's result details here. Click save when
            you're done.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 py-4"
          >
            <FormField
              control={form.control}
              name="normal_price"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">Normal Price</FormLabel>
                  <FormControl className="col-span-3">
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      value={field.value === null ? "" : field.value}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === ""
                            ? null
                            : parseFloat(e.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage className="col-span-4 text-right" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="insurance_price"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">Insurance Price</FormLabel>
                  <FormControl className="col-span-3">
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      value={field.value === null ? "" : field.value}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === ""
                            ? null
                            : parseFloat(e.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage className="col-span-4 text-right" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unpaid_amount"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">Unpaid Amount</FormLabel>
                  <FormControl className="col-span-3">
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      value={field.value === null ? "" : field.value}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === ""
                            ? null
                            : parseFloat(e.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage className="col-span-4 text-right" />
                </FormItem>
              )}
            />

            {/* Notes FormField removed */}

            {submitError && (
              <p className="text-sm text-red-500 col-span-4 text-center">
                {submitError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
