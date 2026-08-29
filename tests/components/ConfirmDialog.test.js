import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";

describe("ConfirmDialog.vue", () => {
  it("does not render modal when modelValue is false", () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        modelValue: false,
        title: "Delete item?",
      },
    });

    expect(wrapper.find(".fixed").exists()).toBe(false);
  });

  it("renders modal when modelValue is true", () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        modelValue: true,
        title: "Delete item?",
        confirmLabel: "Yes, delete",
        cancelLabel: "No, cancel",
      },
      slots: {
        default: "Are you sure you want to delete this?",
      },
    });

    expect(wrapper.find(".fixed").exists()).toBe(true);
    expect(wrapper.text()).toContain("Delete item?");
    expect(wrapper.text()).toContain("Are you sure you want to delete this?");
    expect(wrapper.text()).toContain("Yes, delete");
    expect(wrapper.text()).toContain("No, cancel");
  });

  it("emits update:modelValue with false when cancel button is clicked", async () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        modelValue: true,
        title: "Confirm Action",
      },
    });

    const cancelButton = wrapper.findAll("button")[0];
    await cancelButton.trigger("click");

    expect(wrapper.emitted("update:modelValue")).toBeTruthy();
    expect(wrapper.emitted("update:modelValue")[0]).toEqual([false]);
  });

  it("emits confirm when confirm button is clicked", async () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        modelValue: true,
        title: "Confirm Action",
      },
    });

    const buttons = wrapper.findAll("button");
    const confirmButton = buttons[buttons.length - 1];
    await confirmButton.trigger("click");

    expect(wrapper.emitted("confirm")).toBeTruthy();
  });
});
