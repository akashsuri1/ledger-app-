import {
  useRef,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import { toast } from "sonner";

import Modal from "../ui/Modal";

import {
  useLedger,
} from "../../hooks/useLedger";

interface RegionModalProps {
  open: boolean;

  regionId: number | null;

  onClose: () => void;
}

function RegionModalContent({
  open,
  regionId,
  onClose,
}: RegionModalProps) {
  const {
    regions,
    addRegion,
    updateRegion,
  } = useLedger();

  const region =
    regionId === null
      ? undefined
      : regions.find(
          (item) =>
            item.id === regionId,
        );

  const [name, setName] =
    useState(region?.name ?? "");
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);

  const isEditing =
    regionId !== null;

  function closeModal() {
    if (pending.current) return;
    setName("");
    onClose();
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (pending.current) return;

    const cleanName =
      name.trim();

    if (!cleanName) {
      toast.error(
        "Region name is required.",
      );

      return;
    }

    pending.current = true;
    setBusy(true);
    try {
      if (
        regionId !== null
      ) {
        await updateRegion(
          regionId,
          cleanName,
        );

        toast.success(
          "Region updated successfully",
        );
      } else {
        await addRegion({
          name: cleanName,
        });

        toast.success(
          "Region added successfully",
        );
      }

      pending.current = false;
      closeModal();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save region.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title={
        isEditing
          ? "Edit Region"
          : "Add Region"
      }
      description={
        isEditing
          ? "Update the name of this region."
          : "Create a new region for organizing parties."
      }
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <div>
          <label htmlFor="region-name" className="mb-2 block text-sm font-medium text-slate-700">
            Region Name *
          </label>

          <input
            id="region-name"
            autoFocus
            value={name}
            onChange={(event) =>
              setName(
                event.target.value,
              )
            }
            placeholder="Example: Jammu"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-slate-500"
          />

          <p className="mt-2 text-xs text-slate-400">
            Parties can later be assigned or moved to this region.
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={closeModal}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {busy ? "Saving..." : isEditing
              ? "Save Changes"
              : "Add Region"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function RegionModal(
  props: RegionModalProps,
) {
  return (
    <RegionModalContent
      key={`${props.open ? "open" : "closed"}-${props.regionId ?? "new"}`}
      {...props}
    />
  );
}
