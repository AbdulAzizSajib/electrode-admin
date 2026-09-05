
import { Form, Input, InputNumber, Button, Select } from 'antd'
import { Plus, Trash2, ArrowDown, ArrowUp } from 'lucide-react'
import { ImageUrlField } from "./image-url-field"
import { MAX_DELIVERY_ZONES } from '@/lib/api/landing-pages'

/**
 * The repeatable rows a landing page is made of.
 *
 * All built on Ant Design's `Form.List`, which is what the rest of the admin's
 * repeating editors use. Each keeps its own add/remove/reorder controls rather
 * than sharing one generic component: the rows differ in what they contain and
 * in which of them may be removed, and a shared abstraction that took eight
 * props to express those differences would be harder to read than four small
 * lists.
 */

const ROW = 'rounded-lg border border-border bg-muted/30 p-3'

function RowActions({
  index,
  total,
  onMove,
  onRemove,
  canRemove = true,
}: {
  index: number
  total: number
  onMove: (from: number, to: number) => void
  onRemove: () => void
  canRemove?: boolean
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button
        type="text"
        size="small"
        icon={<ArrowUp className="size-4" />}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        aria-label="Move up"
      />
      <Button
        type="text"
        size="small"
        icon={<ArrowDown className="size-4" />}
        disabled={index === total - 1}
        onClick={() => onMove(index, index + 1)}
        aria-label="Move down"
      />
      <Button
        type="text"
        size="small"
        danger
        icon={<Trash2 className="size-4" />}
        disabled={!canRemove}
        onClick={onRemove}
        aria-label="Remove"
      />
    </div>
  )
}

/**
 * The campaign gallery.
 *
 * Order is authored, not derived: the first item is what a visitor arriving
 * from an ad sees in the first second, which is the merchant's call.
 */
export function MediaListField() {
  return (
    <Form.List name="media">
      {(fields, { add, remove, move }) => (
        <div className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <div key={field.key} className={`${ROW} flex gap-3`}>
              <div className="grid flex-1 gap-x-3 sm:grid-cols-2">
                <Form.Item
                  name={[field.name, 'type']}
                  label="Type"
                  initialValue="IMAGE"
                  className="mb-2"
                >
                  <Select
                    options={[
                      { value: 'IMAGE', label: 'Image' },
                      { value: 'VIDEO', label: 'Video' },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  noStyle
                  shouldUpdate={(prev, next) =>
                    prev.media?.[field.name]?.type !== next.media?.[field.name]?.type
                  }
                >
                  {({ getFieldValue }) =>
                    getFieldValue(['media', field.name, 'type']) === 'VIDEO' ? (
                      <>
                        <Form.Item
                          name={[field.name, 'url']}
                          label="Video URL"
                          className="mb-2"
                          rules={[{ required: true, message: 'Add the video URL' }]}
                        >
                          <Input placeholder="https://…/clip.mp4" />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, 'thumbnailUrl']}
                          label="Poster image"
                          className="mb-2"
                          extra="Shown before the video is played."
                        >
                          <ImageUrlField />
                        </Form.Item>
                      </>
                    ) : (
                      <>
                        <Form.Item
                          name={[field.name, 'url']}
                          label="Image"
                          className="mb-2"
                          rules={[{ required: true, message: 'Add an image' }]}
                        >
                          <ImageUrlField />
                        </Form.Item>
                        <Form.Item name={[field.name, 'alt']} label="Alt text" className="mb-2">
                          <Input placeholder="What the picture shows" />
                        </Form.Item>
                      </>
                    )
                  }
                </Form.Item>
              </div>

              <RowActions
                index={index}
                total={fields.length}
                onMove={move}
                onRemove={() => remove(field.name)}
              />
            </div>
          ))}

          <Button
            type="dashed"
            onClick={() => add({ type: 'IMAGE', url: '' })}
            icon={<Plus className="size-4" />}
          >
            Add image or video
          </Button>

          <p className="text-xs text-muted-foreground">
            Leave this empty to use the product&apos;s own photos.
          </p>
        </div>
      )}
    </Form.List>
  )
}

export function HighlightsListField() {
  return (
    <Form.List name="highlights">
      {(fields, { add, remove, move }) => (
        <div className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <div key={field.key} className={`${ROW} flex gap-3`}>
              <div className="grid flex-1 gap-x-3 sm:grid-cols-3">
                <Form.Item
                  name={[field.name, 'title']}
                  label="Heading"
                  className="mb-2"
                  rules={[{ required: true, message: 'Give this point a heading' }]}
                >
                  <Input placeholder="সারা দেশে ডেলিভারি" />
                </Form.Item>
                <Form.Item name={[field.name, 'text']} label="Detail" className="mb-2">
                  <Input placeholder="২-৪ দিনের মধ্যে" />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'icon']}
                  label="Icon"
                  className="mb-2"
                  extra="An Iconify name, e.g. mdi:truck-fast"
                >
                  <Input placeholder="mdi:truck-fast" />
                </Form.Item>
              </div>
              <RowActions
                index={index}
                total={fields.length}
                onMove={move}
                onRemove={() => remove(field.name)}
              />
            </div>
          ))}
          <Button type="dashed" onClick={() => add({ title: '' })} icon={<Plus className="size-4" />}>
            Add a selling point
          </Button>
        </div>
      )}
    </Form.List>
  )
}

export function FaqsListField() {
  return (
    <Form.List name="faqs">
      {(fields, { add, remove, move }) => (
        <div className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <div key={field.key} className={`${ROW} flex gap-3`}>
              <div className="flex-1">
                <Form.Item
                  name={[field.name, 'question']}
                  label="Question"
                  className="mb-2"
                  rules={[{ required: true, message: 'Write the question' }]}
                >
                  <Input placeholder="সাইজ কি এক্সচেঞ্জ করা যাবে?" />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'answer']}
                  label="Answer"
                  className="mb-0"
                  rules={[{ required: true, message: 'Write the answer' }]}
                >
                  <Input.TextArea rows={2} placeholder="হ্যাঁ, ৭ দিনের মধ্যে।" />
                </Form.Item>
              </div>
              <RowActions
                index={index}
                total={fields.length}
                onMove={move}
                onRemove={() => remove(field.name)}
              />
            </div>
          ))}
          <Button
            type="dashed"
            onClick={() => add({ question: '', answer: '' })}
            icon={<Plus className="size-4" />}
          >
            Add a question
          </Button>
        </div>
      )}
    </Form.List>
  )
}

export function QuotesListField() {
  return (
    <Form.List name="quotes">
      {(fields, { add, remove, move }) => (
        <div className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <div key={field.key} className={`${ROW} flex gap-3`}>
              <div className="grid flex-1 gap-x-3 sm:grid-cols-2">
                <Form.Item
                  name={[field.name, 'name']}
                  label="Customer name"
                  className="mb-2"
                  rules={[{ required: true, message: 'Whose quote is this?' }]}
                >
                  <Input placeholder="করিম" />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'rating']}
                  label="Rating"
                  className="mb-2"
                  extra="Left blank, no stars are shown — better than showing five nobody gave."
                >
                  <InputNumber min={1} max={5} className="w-full" />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'text']}
                  label="Quote"
                  className="mb-2 sm:col-span-2"
                  rules={[{ required: true, message: 'What did they say?' }]}
                >
                  <Input.TextArea rows={2} placeholder="কাপড়ের মান খুব ভালো।" />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'photoUrl']}
                  label="Photo"
                  className="mb-2"
                  extra="Optional — their initial is shown instead."
                >
                  <ImageUrlField />
                </Form.Item>
              </div>
              <RowActions
                index={index}
                total={fields.length}
                onMove={move}
                onRemove={() => remove(field.name)}
              />
            </div>
          ))}
          <Button
            type="dashed"
            onClick={() => add({ name: '', text: '' })}
            icon={<Plus className="size-4" />}
          >
            Add a customer quote
          </Button>
        </div>
      )}
    </Form.List>
  )
}

export function TrustBadgesListField() {
  return (
    <Form.List name="trustBadges">
      {(fields, { add, remove, move }) => (
        <div className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <div key={field.key} className={`${ROW} flex gap-3`}>
              <div className="grid flex-1 gap-x-3 sm:grid-cols-2">
                <Form.Item
                  name={[field.name, 'label']}
                  label="Label"
                  className="mb-2"
                  rules={[{ required: true, message: 'What does this badge say?' }]}
                >
                  <Input placeholder="১০০% অরিজিনাল" />
                </Form.Item>
                <Form.Item name={[field.name, 'icon']} label="Icon" className="mb-2">
                  <Input placeholder="mdi:shield-check" />
                </Form.Item>
              </div>
              <RowActions
                index={index}
                total={fields.length}
                onMove={move}
                onRemove={() => remove(field.name)}
              />
            </div>
          ))}
          <Button type="dashed" onClick={() => add({ label: '' })} icon={<Plus className="size-4" />}>
            Add a badge
          </Button>
        </div>
      )}
    </Form.List>
  )
}

/** Mirrors the backend's zone-key pattern. */
const ZONE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * The delivery zones — the inside/outside Dhaka pair, or whatever the merchant
 * makes of it.
 *
 * The price here is what the shopper is CHARGED. It bypasses the product's
 * shipping rule entirely, and neither the shop's free-shipping threshold nor a
 * coupon waiver applies to it: the page states a delivery charge and that is
 * what is collected.
 *
 * The last row cannot be removed. A page with no zone can charge no delivery
 * and its product would be undeliverable — the server refuses such a save
 * anyway, and letting the merchant reach that state only to be told no is worse
 * than not offering it.
 */
export function DeliveryZonesField() {
  return (
    <Form.List
      name="deliveryZones"
      rules={[
        {
          validator: async (_rule, zones: { key?: string }[] = []) => {
            const keys = zones.map((zone) => zone?.key).filter(Boolean)
            if (new Set(keys).size !== keys.length) {
              throw new Error('Each area needs its own distinct key')
            }
          },
        },
      ]}
    >
      {(fields, { add, remove, move }, { errors }) => (
        <div className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <div key={field.key} className={`${ROW} flex gap-3`}>
              <div className="grid flex-1 gap-x-3 sm:grid-cols-3">
                <Form.Item
                  name={[field.name, 'label']}
                  label="Area"
                  className="mb-2"
                  rules={[{ required: true, message: 'Name the delivery area' }]}
                >
                  <Input placeholder="ঢাকার ভিতরে" />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'price']}
                  label="Delivery charge"
                  className="mb-2"
                  rules={[{ required: true, message: 'Set the charge (0 for free)' }]}
                >
                  <InputNumber min={0} className="w-full" />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'key']}
                  label="Key"
                  className="mb-2"
                  extra="Internal. Changing it on a live page is safe."
                  rules={[
                    { required: true, message: 'Give this area a key' },
                    {
                      pattern: ZONE_KEY_PATTERN,
                      message: 'Lowercase words separated by single hyphens',
                    },
                  ]}
                >
                  <Input placeholder="inside-dhaka" />
                </Form.Item>
              </div>
              <RowActions
                index={index}
                total={fields.length}
                onMove={move}
                onRemove={() => remove(field.name)}
                // At least one zone, always. See the note above.
                canRemove={fields.length > 1}
              />
            </div>
          ))}

          <Form.ErrorList errors={errors} />

          <Button
            type="dashed"
            disabled={fields.length >= MAX_DELIVERY_ZONES}
            onClick={() => add({ key: '', label: '', price: 0 })}
            icon={<Plus className="size-4" />}
          >
            Add a delivery area
          </Button>
        </div>
      )}
    </Form.List>
  )
}
