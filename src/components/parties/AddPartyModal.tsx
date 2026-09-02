import {
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import {
  toast,
} from "sonner";

import Modal from "../ui/Modal";

import {
  useLedger,
} from "../../context/LedgerContext";

interface AddPartyModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AddPartyModal({
  open,
  onClose,
}: AddPartyModalProps) {
  const {
    regions,
    addParty,
  } = useLedger();

  const [name, setName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [regionId, setRegionId] =
    useState("");

  const [address, setAddress] =
    useState("");

  const [gstin, setGstin] =
    useState("");

  const [notes, setNotes] =
    useState("");

  function resetForm() {
    setName("");
    setPhone("");
    setRegionId("");
    setAddress("");
    setGstin("");
    setNotes("");
  }

  function closeModal() {
    resetForm();
    onClose();
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const cleanPhone =
      phone.trim();

    if (!name.trim()) {
      toast.error(
        "Party name is required.",
      );
      return;
    }

    if (!regionId) {
      toast.error(
        "Please select a region.",
      );
      return;
    }

    if (
      cleanPhone &&
      !/^[0-9]{10}$/.test(
        cleanPhone,
      )
    ) {
      toast.error(
        "Phone number must contain exactly 10 digits.",
      );
      return;
    }

    try {
      const party =
        addParty({
          name:
            name.trim(),

          phone:
            cleanPhone,

          regionId:
            Number(regionId),

          address:
            address.trim(),

          gstin:
            gstin
              .trim()
              .toUpperCase(),

          notes:
            notes.trim(),
        });

      const region =
        regions.find(
          (item) =>
            item.id ===
            party.regionId,
        );

      toast.success(
        "Party added successfully",
        {
          description:
            region
              ? `${party.name} has been assigned to ${region.name}.`
              : party.name,
        },
      );

      closeModal();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to add party.",
      );
    }
  }

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title="Add Party"
      description="Create a new party and assign it to a region."
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Party Name *
          </label>

          <input
            value={name}
            onChange={(event) =>
              setName(
                event.target.value,
              )
            }
            placeholder="ABC Traders"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Phone
            </label>

          <input
            value={phone}
            inputMode="numeric"
              onChange={(event) =>
                setPhone(
                  event.target.value,
                )
              }
              placeholder="9876543210"
              maxLength={10}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Region *
            </label>

            <select
              value={regionId}
              onChange={(event) =>
                setRegionId(
                  event.target.value,
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-slate-500"
            >
              <option value="">
                Select region
              </option>

              {regions.map(
                (region) => (
                  <option
                    key={
                      region.id
                    }
                    value={
                      region.id
                    }
                  >
                    {
                      region.name
                    }
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Address
          </label>

          <textarea
            value={address}
            onChange={(event) =>
              setAddress(
                event.target.value,
              )
            }
            rows={2}
            placeholder="Party address..."
            className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            GSTIN
          </label>

          <input
            value={gstin}
            onChange={(event) =>
              setGstin(
                event.target.value,
              )
            }
            placeholder="Optional"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm uppercase outline-none focus:border-slate-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Notes
          </label>

          <textarea
            value={notes}
            onChange={(event) =>
              setNotes(
                event.target.value,
              )
            }
            rows={3}
            placeholder="Optional notes..."
            className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={closeModal}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Save Party
          </button>
        </div>
      </form>
    </Modal>
  );
}
