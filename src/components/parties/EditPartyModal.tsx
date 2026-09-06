import {
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

interface EditPartyModalProps {
  open: boolean;
  partyId: number | null;
  onClose: () => void;
}

function EditPartyModalContent({
  open,
  partyId,
  onClose,
}: EditPartyModalProps) {
  const {
    parties,
    regions,
    updateParty,
  } = useLedger();

  const party =
    partyId === null
      ? undefined
      : parties.find(
          (item) =>
            item.id === partyId,
        );

  const [name, setName] =
    useState(party?.name ?? "");

  const [phone, setPhone] =
    useState(party?.phone ?? "");

  const [
    regionId,
    setRegionId,
  ] = useState(
    party?.regionId.toString() ?? "",
  );

  const [address, setAddress] =
    useState(party?.address ?? "");

  const [gstin, setGstin] =
    useState(party?.gstin ?? "");

  const [notes, setNotes] =
    useState(party?.notes ?? "");

  if (!party) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Edit Party"
      >
        <p className="py-8 text-center text-sm text-slate-500">
          Party not found.
        </p>
      </Modal>
    );
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!party) {
      toast.error(
        "Party not found.",
      );
      return;
    }

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
      updateParty(
        party.id,
        {
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
        },
      );

      toast.success(
        "Party updated successfully",
      );

      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update party.",
      );
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Party"
      description={`Update information for ${party.name}.`}
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
              maxLength={10}
              onChange={(event) =>
                setPhone(
                  event.target.value,
                )
              }
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
                    key={region.id}
                    value={region.id}
                  >
                    {region.name}
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
            rows={2}
            onChange={(event) =>
              setAddress(
                event.target.value,
              )
            }
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
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm uppercase outline-none focus:border-slate-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Notes / Description
          </label>

          <textarea
            value={notes}
            rows={4}
            onChange={(event) =>
              setNotes(
                event.target.value,
              )
            }
            placeholder="Notes about this party..."
            className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function EditPartyModal(
  props: EditPartyModalProps,
) {
  return (
    <EditPartyModalContent
      key={props.partyId ?? "no-party"}
      {...props}
    />
  );
}
