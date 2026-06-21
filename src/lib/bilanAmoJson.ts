export interface AmoResultRecord {
  id: string;
  patient_id: string;
  doctor_id: string;
  result_date: string;
  status: string;
  normal_price: number | null;
  insurance_price: number | null;
  description?: string | null;
  patient: {
    id: string;
    patient_unique_id: string;
    full_name: string;
    date_of_birth: string | null;
    gender: string | null;
    phone: string | null;
  } | null;
  doctor: {
    id: string;
    full_name: string;
    phone: string | null;
    hospital: string | null;
  } | null;
}

export interface AmoResultValueRecord {
  patient_result_id: string;
  value: string;
  test_parameter: {
    id: string;
    name: string;
    unit: string | null;
    reference_range: string | null;
    order: number;
    test_type: {
      id: string;
      name: string;
      description: string | null;
      category: {
        id: string;
        name: string;
      } | null;
    } | null;
  } | null;
}

export interface AmoVhbRecord {
  id: string;
  result_id: string;
  value: string | null;
}

export interface AmoJsonParameter {
  id: string;
  name: string;
  value: string;
  unit: string | null;
  reference_range: string | null;
  order: number;
}

export interface AmoJsonTestType {
  id: string;
  name: string;
  description: string | null;
  parameters: AmoJsonParameter[];
}

export interface AmoJsonCategory {
  id: string;
  name: string;
  test_types: AmoJsonTestType[];
}

export interface BilanAmoJsonDocument {
  schema_version: "1.0";
  exported_at: string;
  results: Array<{
    id: string;
    result_date: string;
    status: string;
    normal_price: number | null;
    insurance_price: number | null;
    patient: {
      id: string;
      unique_id: string | null;
      full_name: string | null;
    };
    doctor: {
      id: string;
      full_name: string | null;
      phone: string | null;
      hospital: string | null;
    };
    specialized_results: {
      vhb: {
        id: string;
        value: string | null;
      } | null;
    };
    categories: AmoJsonCategory[];
  }>;
}

const compareNames = (left: string, right: string) =>
  left.localeCompare(right, "fr", { sensitivity: "base" });

const groupResultValues = (
  values: AmoResultValueRecord[]
): AmoJsonCategory[] => {
  const categories = new Map<string, AmoJsonCategory>();

  values.forEach((resultValue) => {
    const parameter = resultValue.test_parameter;
    const testType = parameter?.test_type;
    const category = testType?.category;

    if (!parameter || !testType || !category) return;

    let categoryGroup = categories.get(category.id);
    if (!categoryGroup) {
      categoryGroup = {
        id: category.id,
        name: category.name,
        test_types: [],
      };
      categories.set(category.id, categoryGroup);
    }

    let testTypeGroup = categoryGroup.test_types.find(
      (group) => group.id === testType.id
    );
    if (!testTypeGroup) {
      testTypeGroup = {
        id: testType.id,
        name: testType.name,
        description: testType.description,
        parameters: [],
      };
      categoryGroup.test_types.push(testTypeGroup);
    }

    testTypeGroup.parameters.push({
      id: parameter.id,
      name: parameter.name,
      value: resultValue.value,
      unit: parameter.unit,
      reference_range: parameter.reference_range,
      order: parameter.order,
    });
  });

  const groupedCategories = Array.from(categories.values());
  groupedCategories.forEach((category) => {
    category.test_types.forEach((testType) => {
      testType.parameters.sort(
        (left, right) =>
          left.order - right.order || compareNames(left.name, right.name)
      );
    });
    category.test_types.sort((left, right) =>
      compareNames(left.name, right.name)
    );
  });
  groupedCategories.sort((left, right) => compareNames(left.name, right.name));

  return groupedCategories;
};

export const buildBilanAmoJson = (
  results: AmoResultRecord[],
  values: AmoResultValueRecord[],
  vhbRows: AmoVhbRecord[] = [],
  exportedAt = new Date().toISOString()
): BilanAmoJsonDocument => {
  const valuesByResult = new Map<string, AmoResultValueRecord[]>();
  const vhbByResult = new Map(
    vhbRows.map((vhb) => [vhb.result_id, vhb] as const)
  );

  values.forEach((resultValue) => {
    const existing = valuesByResult.get(resultValue.patient_result_id) || [];
    existing.push(resultValue);
    valuesByResult.set(resultValue.patient_result_id, existing);
  });

  return {
    schema_version: "1.0",
    exported_at: exportedAt,
    results: results.map((result) => ({
      id: result.id,
      result_date: result.result_date,
      status: result.status,
      normal_price: result.normal_price,
      insurance_price: result.insurance_price,
      patient: {
        id: result.patient?.id || result.patient_id,
        unique_id: result.patient?.patient_unique_id || null,
        full_name: result.patient?.full_name || null,
      },
      doctor: {
        id: result.doctor?.id || result.doctor_id,
        full_name: result.doctor?.full_name || null,
        phone: result.doctor?.phone || null,
        hospital: result.doctor?.hospital || null,
      },
      specialized_results: {
        vhb: vhbByResult.has(result.id)
          ? {
              id: vhbByResult.get(result.id)!.id,
              value: vhbByResult.get(result.id)!.value,
            }
          : null,
      },
      categories: groupResultValues(valuesByResult.get(result.id) || []),
    })),
  };
};

export const downloadJson = (
  payload: BilanAmoJsonDocument,
  filename: string
) => {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
