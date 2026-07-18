// Structured-output schemas. The intake schema mirrors ../patient_intake_schema.json,
// adapted to the structured-outputs subset: every object carries
// additionalProperties:false and a full `required` list; unknown values are null.

// Structured outputs allows at most 16 union-typed parameters per schema, so
// plain fields are non-nullable: unknown text -> "" and unknown numbers -> 0
// (see the extraction prompts). Only enum fields keep a null option.
const nullable = (type) =>
  type === "integer"
    ? { type: "integer", description: "0 if unknown" }
    : { type: "string", description: "Empty string if unknown" };

const address = {
  type: "object",
  additionalProperties: false,
  required: ["addressLine1", "city", "state", "zipCode"],
  properties: {
    addressLine1: nullable("string"),
    city: nullable("string"),
    state: nullable("string"),
    zipCode: nullable("string"),
  },
};

const MED_CLASSES = [
  "anticoagulation",
  "antiplatelet",
  "nsaids",
  "diabetes",
  "steroids",
  "hypertension",
  "immunosuppression",
];

const nullableEnum = (values) => ({
  anyOf: [{ type: "string", enum: values }, { type: "null" }],
});

export const intakeSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "demographics",
    "social",
    "procedureInformation",
    "comorbidities",
    "homeMedications",
    "pharmacy",
    "visitIntake",
    "careContacts",
  ],
  properties: {
    demographics: {
      type: "object",
      additionalProperties: false,
      required: ["name", "dob", "age", "address", "cellNumber"],
      properties: {
        name: {
          type: "object",
          additionalProperties: false,
          required: ["firstName", "lastName"],
          properties: {
            firstName: nullable("string"),
            lastName: nullable("string"),
          },
        },
        dob: nullable("string"),
        age: nullable("integer"),
        address,
        cellNumber: nullable("string"),
      },
    },
    social: {
      type: "object",
      additionalProperties: false,
      required: ["alternateContact", "insurance"],
      properties: {
        alternateContact: {
          type: "object",
          additionalProperties: false,
          required: ["name", "number", "relationship"],
          properties: {
            name: nullable("string"),
            number: nullable("string"),
            relationship: nullable("string"),
          },
        },
        insurance: nullableEnum(["Private", "Public"]),
      },
    },
    procedureInformation: {
      type: "object",
      additionalProperties: false,
      required: [
        "datetimeOfProcedure",
        "procedure",
        "specialtyOfProcedure",
        "locationOfProcedure",
      ],
      properties: {
        datetimeOfProcedure: nullable("string"),
        procedure: nullable("string"),
        specialtyOfProcedure: nullable("string"),
        locationOfProcedure: nullable("string"),
      },
    },
    comorbidities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "nameOfComorbidity",
          "cardiacDisease",
          "renalDisease",
          "liverDisease",
          "pulmonaryDisease",
        ],
        properties: {
          nameOfComorbidity: nullable("string"),
          cardiacDisease: { type: "boolean" },
          renalDisease: { type: "boolean" },
          liverDisease: { type: "boolean" },
          pulmonaryDisease: { type: "boolean" },
        },
      },
    },
    homeMedications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["medicationName", "dose", "frequency", "class"],
        properties: {
          medicationName: nullable("string"),
          dose: nullable("string"),
          frequency: nullable("string"),
          class: nullableEnum(MED_CLASSES),
        },
      },
    },
    pharmacy: {
      type: "object",
      additionalProperties: false,
      required: ["name", "address", "phoneNumber"],
      properties: {
        name: nullable("string"),
        address,
        phoneNumber: nullable("string"),
      },
    },
    visitIntake: {
      type: "object",
      additionalProperties: false,
      required: ["dateOfVisit", "dietInstructions", "medicationInstructions"],
      properties: {
        dateOfVisit: nullable("string"),
        dietInstructions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["dietType", "daysPriorToProcedure"],
            properties: {
              dietType: nullable("string"),
              daysPriorToProcedure: nullable("integer"),
            },
          },
        },
        medicationInstructions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "medicationClass",
              "instruction",
              "daysPriorToProcedure",
              "freeTextInstructions",
            ],
            properties: {
              medicationClass: nullableEnum(MED_CLASSES),
              instruction: nullableEnum(["Continue", "Hold"]),
              daysPriorToProcedure: nullable("integer"),
              freeTextInstructions: nullable("string"),
            },
          },
        },
      },
    },
    // App extension: who the patient can call (shown in the hospital-info panel).
    careContacts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "role", "phone"],
        properties: {
          name: nullable("string"),
          role: nullable("string"),
          phone: nullable("string"),
        },
      },
    },
  },
};

export const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["timeline", "greeting", "suggestions", "alarms"],
  properties: {
    timeline: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "title", "size", "details"],
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          title: { type: "string" },
          size: { type: "string", enum: ["major", "minor"] },
          details: {
            type: "string",
            description:
              "2-4 sentence patient-friendly explanation shown when the event is expanded",
          },
        },
      },
    },
    greeting: {
      type: "string",
      description:
        "Friendly greeting stating what the agent understood about the patient's situation, 10-20 words",
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
      description: "Short prompt-suggestion bubbles shown above the chat bar",
    },
    alarms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["datetime", "question"],
        properties: {
          datetime: {
            type: "string",
            description: "Local ISO datetime, e.g. 2026-07-29T08:00",
          },
          question: {
            type: "string",
            description:
              'Yes/no check-in question, e.g. "Did you take your last Eliquis dose this morning?"',
          },
        },
      },
    },
  },
};

export const classifySchema = {
  type: "object",
  additionalProperties: false,
  required: ["adequate", "reason"],
  properties: {
    adequate: { type: "boolean" },
    reason: { type: "string" },
  },
};

export const manualIntakeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "updatedIntake", "complete"],
  properties: {
    reply: {
      type: "string",
      description: "The next conversational message to show the patient",
    },
    updatedIntake: intakeSchema,
    complete: {
      type: "boolean",
      description:
        "True once enough information has been collected to build the timeline",
    },
  },
};
