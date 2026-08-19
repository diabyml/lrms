import React, { FormEvent, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/useDebounce";
import { extractTestTypeName } from "@/lib/utils";

export type TestTypeSelectorCategory = {
  id: string;
  name: string;
};

export type TestTypeSelectorTest = {
  id: string;
  name: string;
  category_id: string;
};

type TestTypeSelectorProps = {
  categories: TestTypeSelectorCategory[];
  tests: TestTypeSelectorTest[];
  selectedTestIds: string[];
  onTestToggle: (
    checked: boolean | "indeterminate",
    testTypeId: string
  ) => void | Promise<void>;
  onAddTests: (testTypeIds: string[]) => void | Promise<void>;
  disabled?: boolean;
  showSelectedPills?: boolean;
};

export function TestTypeSelector({
  categories,
  tests,
  selectedTestIds,
  onTestToggle,
  onAddTests,
  disabled = false,
  showSelectedPills = false,
}: TestTypeSelectorProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | undefined
  >(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 250);
  const selectedSet = useMemo(
    () => new Set(selectedTestIds),
    [selectedTestIds]
  );
  const selectedTests = useMemo(() => {
    const testsById = new Map(tests.map((test) => [test.id, test]));
    return selectedTestIds
      .map((testId) => testsById.get(testId))
      .filter((test): test is TestTypeSelectorTest => Boolean(test));
  }, [selectedTestIds, tests]);

  const filteredTests = useMemo(() => {
    if (!selectedCategoryId) {
      if (!debouncedSearch) return tests;
      const normalizedSearch = debouncedSearch.toLowerCase();
      return tests.filter((test) =>
        test.name.toLowerCase().includes(normalizedSearch)
      );
    }

    return tests.filter((test) => test.category_id === selectedCategoryId);
  }, [debouncedSearch, selectedCategoryId, tests]);

  const handleRapidSelection = (event: FormEvent) => {
    event.preventDefault();
    void onAddTests(filteredTests.map((test) => test.id));
    setSearchTerm("");
  };

  return (
    <div className="space-y-4">
      <div style={{ marginBottom: 16 }}>
        <Label htmlFor="category-filter">Catégorie</Label>
        <Select
          value={selectedCategoryId ?? "all"}
          onValueChange={(value) =>
            setSelectedCategoryId(value === "all" ? undefined : value)
          }
          disabled={disabled}
        >
          <SelectTrigger id="category-filter">
            <SelectValue placeholder="Filtrer par catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Label className="text-base font-semibold">Types de Tests Inclus</Label>

      <form onSubmit={handleRapidSelection}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher et ajouter un type de test..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-9 w-full pl-10"
            disabled={disabled || tests.length === 0}
          />
        </div>
      </form>

      {showSelectedPills && selectedTests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Sélectionnés ({selectedTests.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedTests.map((test) => (
              <Badge
                key={test.id}
                variant="secondary"
                className="gap-1.5 py-1 pl-2.5 pr-1.5"
              >
                <span>{extractTestTypeName(test.name)}</span>
                <button
                  type="button"
                  onClick={() => void onTestToggle(false, test.id)}
                  disabled={disabled}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                  aria-label={`Retirer ${extractTestTypeName(test.name)}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {tests.length > 0 ? (
        <div className="grid max-h-80 grid-cols-2 gap-x-4 gap-y-3 overflow-y-auto rounded-md border p-4">
          {filteredTests.length > 0 ? (
            filteredTests.map((test) => (
              <div key={test.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`test-type-${test.id}`}
                  checked={selectedSet.has(test.id)}
                  onCheckedChange={(checked) =>
                    void onTestToggle(checked, test.id)
                  }
                  disabled={disabled}
                />
                <label
                  htmlFor={`test-type-${test.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {extractTestTypeName(test.name)}
                </label>
              </div>
            ))
          ) : (
            <p className="col-span-full py-4 text-center text-sm text-muted-foreground">
              Aucun type de test ne correspond.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          Aucun type de test configuré.
        </p>
      )}
    </div>
  );
}
