# 1. Improve food selection in meal entry

When the user types in the food field in the meal-entry form, show matching foods from the saved foods list and a `Create` button for a new food. Don't show `Create` if an exact match already exists.

- Clicking a suggested food immediately adds it to the current meal.
- Clicking `Create` opens the existing food creation form with the entered name prefilled. After saving, automatically add the new food to the current meal.

Reuse the existing search, suggestion, and food creation logic. Keep the changes minimal and consistent with the current UI.

---

# 2. Add micronutrient input modes

In the food creation form, allow users to enter each vitamin and mineral in either of two modes:

- **Grams:** Enter the amount using the nutrient's usual unit (e.g., mg or µg).
- **% DV:** Enter the amount as a percentage of the recommended daily value.

Add a switch between the two modes. When switching, convert the displayed values so the actual nutrient amounts remain unchanged. Use the correct unit and daily value for each nutrient, reusing existing data and logic. If a daily value is not available, don't guess one.

Make sure values are saved correctly and displayed correctly when the food is reopened. Reuse the existing form design and avoid duplicating logic.

---

# 3. Add default tags to foods

Add a default-tags field to each food item. Users should be able to set the tags when creating a food and change them later in the existing food-editing form.

Save the tags with the food item. Reuse the existing tag components and data structures, and ensure foods without tags continue to work.

Keep the implementation simple and avoid unrelated changes.

---

# 4. Improve the food photo button

In the food creation form, make `dish-photo-button` exactly the same size and shape as the food image thumbnail.

When no image is selected, show the upload icon. After an image is selected, display its preview inside the button instead of the icon. Clicking the button should open the image picker to select or replace the photo.

Each food can have only one image. Selecting a new image must replace the previous one.

Reuse existing image-handling logic and styles, and keep the changes minimal.

---

# 5. Improve recipe ingredients and live nutrition updates

In the recipe creation form, update `ingredients-block` to use the same UI style and layout as food rows in the meal-entry form. Use the same behavior for entering and editing ingredient weights.

Whenever an ingredient is added, removed, replaced, or its weight changes, immediately recalculate and update all recipe nutrition values, including calories, protein, fat, carbohydrates, vitamins, minerals, and other tracked parameters.

Reuse the existing food-row components, weight-editing behavior, and nutrition calculation logic wherever possible. Avoid code duplication and unrelated changes.