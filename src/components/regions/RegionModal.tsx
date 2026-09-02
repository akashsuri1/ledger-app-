import {
  useEffect,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import { toast } from "sonner";

import Modal from "../ui/Modal";

import {
  useLedger,
} from "../../context/LedgerContext";

interface RegionModalProps {
  open: boolean;

  regionId: number | null;

  onClose: () => void;
}

export default function RegionModal({
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
    useState("");

  const isEditing =
    regionId !== null;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (region) {
      setName(region.name);
    } else {
      setName("");
    }
  }, [
    open,
    region,
  ]);

  function closeModal() {
    setName("");
    onClose();
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const cleanName =
      name.trim();

    if (!cleanName) {
      toast.error(
        "Region name is required.",
      );

      return;
    }

    try {
      if (
        regionId !== null
      ) {
        updateRegion(
          regionId,
          cleanName,
        );

        toast.success(
          "Region updated successfully",
        );
      } else {
        addRegion({
          name: cleanName,
        });

        toast.success(
          "Region added successfully",
        );
      }

      closeModal();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save region.",
      );
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
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Region Name *
          </label>

          <input
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
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {isEditing
              ? "Save Changes"
              : "Add Region"}
          </button>
        </div>
      </form>
    </Modal>
  );
}