import React, { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  Layers,
  Plus,
  Search,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type InvoicePickerTest = {
  id: string;
  name: string;
  code?: string | null;
  normal_price: number | null;
  insurance_price: number | null;
};

export type InvoicePickerProfile = {
  id: string;
  name: string;
  description: string | null;
  tests: InvoicePickerTest[];
};

type InvoiceTestPickerProps = {
  tests: InvoicePickerTest[];
  profiles: InvoicePickerProfile[];
  selectedTestIds: string[];
  onSelectedTestIdsChange: (ids: string[]) => void;
  disabled?: boolean;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalizeCode = (value: string | null | undefined) =>
  normalize(value?.trim() || "");

export const getDisplayTestName = (name: string) =>
  name.split("#")[0].trim() || name;

const TestCodeBadge = ({ code }: { code?: string | null }) =>
  code ? (
    <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
      {code}
    </Badge>
  ) : null;

export function InvoiceTestPicker({
  tests,
  profiles,
  selectedTestIds,
  onSelectedTestIdsChange,
  disabled,
}: InvoiceTestPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(
    () => new Set()
  );

  const selectedSet = useMemo(
    () => new Set(selectedTestIds),
    [selectedTestIds]
  );

  const testsById = useMemo(
    () => new Map(tests.map((test) => [test.id, test])),
    [tests]
  );

  const selectedTests = useMemo(
    () =>
      selectedTestIds
        .map((id) => testsById.get(id))
        .filter(Boolean) as InvoicePickerTest[],
    [selectedTestIds, testsById]
  );

  const filteredProfiles = useMemo(() => {
    const search = normalize(query.trim());
    if (!search) return profiles;
    return profiles.filter((profile) => normalize(profile.name).includes(search));
  }, [profiles, query]);

  const filteredTests = useMemo(() => {
    const search = normalize(query.trim());
    if (!search) return tests;

    const exactCodeMatch = tests.find(
      (test) => normalizeCode(test.code) === search
    );
    if (exactCodeMatch) return [exactCodeMatch];

    return tests.filter(
      (test) =>
        normalizeCode(test.code).includes(search) ||
        normalize(getDisplayTestName(test.name)).includes(search)
    );
  }, [query, tests]);

  const mergeTests = (ids: string[]) => {
    onSelectedTestIdsChange([...new Set([...selectedTestIds, ...ids])]);
  };

  const toggleTest = (testId: string) => {
    if (selectedSet.has(testId)) {
      onSelectedTestIdsChange(selectedTestIds.filter((id) => id !== testId));
      return;
    }
    onSelectedTestIdsChange([...selectedTestIds, testId]);
  };

  const addProfile = (profile: InvoicePickerProfile) => {
    mergeTests(profile.tests.map((test) => test.id));
    setQuery("");
  };

  const toggleProfileExpanded = (profileId: string) => {
    setExpandedProfiles((current) => {
      const next = new Set(current);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || filteredProfiles.length === 0) return;
    event.preventDefault();
    addProfile(filteredProfiles[0]);
  };

  const handleTestSelect = (testId: string) => {
    toggleTest(testId);
    setQuery("");
  };

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="min-h-10 w-full justify-between whitespace-normal text-left font-normal"
            disabled={disabled}
          >
            <span className="line-clamp-2">
              {selectedTests.length > 0
                ? `${selectedTests.length} test(s) sélectionné(s)`
                : "Rechercher un profil ou un test..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(760px,calc(100vw-2rem))] p-0"
          align="start"
          side="bottom"
          avoidCollisions={false}
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              onKeyDown={handleInputKeyDown}
              placeholder="Rechercher profil ou test..."
            />
            <CommandList className="max-h-[420px]">
              <CommandEmpty>Aucun profil ou test trouvé.</CommandEmpty>

              {filteredProfiles.length > 0 && (
                <CommandGroup heading="Profils">
                  {filteredProfiles.map((profile) => {
                    const isExpanded = expandedProfiles.has(profile.id);
                    const allSelected =
                      profile.tests.length > 0 &&
                      profile.tests.every((test) => selectedSet.has(test.id));

                    return (
                      <div key={profile.id} className="rounded-md">
                        <CommandItem
                          value={`profile-${profile.name}`}
                          onSelect={() => addProfile(profile)}
                          className="items-start"
                        >
                          <Layers className="mt-0.5 h-4 w-4" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">
                                {profile.name}
                              </span>
                              <Badge variant="secondary">
                                {profile.tests.length} test(s)
                              </Badge>
                              {allSelected && <Badge>Ajouté</Badge>}
                            </div>
                            {profile.description && (
                              <p className="line-clamp-1 text-xs text-muted-foreground">
                                {profile.description}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              toggleProfileExpanded(profile.id);
                            }}
                          >
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              addProfile(profile);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </CommandItem>
                        {isExpanded && (
                          <div className="ml-8 border-l pl-2">
                            {profile.tests.map((test) => (
                              <button
                                key={`${profile.id}-${test.id}`}
                                type="button"
                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                                onClick={() => handleTestSelect(test.id)}
                              >
                                <Check
                                  className={cn(
                                    "h-4 w-4",
                                    selectedSet.has(test.id)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <span className="min-w-0 flex-1">
                                  {getDisplayTestName(test.name)}
                                </span>
                                <TestCodeBadge code={test.code} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CommandGroup>
              )}

              {filteredTests.length > 0 && (
                <CommandGroup heading="Tests">
                  {filteredTests.map((test) => (
                    <CommandItem
                      key={test.id}
                      value={`test-${getDisplayTestName(test.name)}`}
                      onSelect={() => handleTestSelect(test.id)}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4",
                          selectedSet.has(test.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        {getDisplayTestName(test.name)}
                      </span>
                      <TestCodeBadge code={test.code} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedTests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTests.map((test) => (
            <Badge
              key={test.id}
              variant="secondary"
              className="gap-1 whitespace-normal"
            >
              <span>{getDisplayTestName(test.name)}</span>
              <TestCodeBadge code={test.code} />
              <button
                type="button"
                onClick={() => toggleTest(test.id)}
                disabled={disabled}
                aria-label={`Retirer ${getDisplayTestName(test.name)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        Entrée ajoute tous les tests du premier profil trouvé.
      </p>
    </div>
  );
}
