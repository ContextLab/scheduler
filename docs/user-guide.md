# user guide

This guide walks through the process of booking, rescheduling, and cancelling appointments using CDL Scheduler.

## booking an appointment

### step 1: select a meeting type

When you visit the scheduler, you will see a list of available meeting types. Each type shows a name, duration, and description.

Click on a meeting type to proceed.

<!-- screenshot placeholder: meeting type selection page -->
```{image} _static/screenshots/01-meeting-types.png
:alt: Meeting type selection page
:width: 600px
:class: screenshot
```

### step 2: choose a date and time

After selecting a meeting type, a calendar view appears showing available time slots. Available slots are highlighted in green.

- Use the **arrow buttons** to navigate between weeks
- Click on an **available slot** to select it
- The calendar displays times in your local timezone (adjustable via the timezone selector at the top)

<!-- screenshot placeholder: calendar view with available slots -->
```{image} _static/screenshots/02-calendar-view.png
:alt: Calendar view showing available time slots
:width: 600px
:class: screenshot
```

### step 3: fill out the booking form

After clicking a slot, the booking form appears. Fill in:

- **First name** and **Last name** — your name as it should appear on the calendar event
- **Email** — where you will receive the confirmation (and reschedule/cancel links)
- **Format** — choose between virtual (e.g., Zoom) or in-person
- **Purpose** — briefly describe why you are booking
- **Notes** — (optional) any additional details

<!-- screenshot placeholder: booking form -->
```{image} _static/screenshots/03-booking-form.png
:alt: Booking form with fields for name, email, format, purpose, and notes
:width: 600px
:class: screenshot
```

Click **Submit** to complete your booking.

### step 4: confirmation

After submitting, you will see a confirmation page with:

- The meeting date, time, and duration
- The meeting location (virtual link or physical address)
- Links to **reschedule** or **cancel** your booking

```{image} _static/screenshots/04-confirmation.png
:alt: Booking confirmation page showing meeting details
:width: 600px
:class: screenshot
```

```{tip}
Save the reschedule and cancel links from the confirmation page or your confirmation email — you will need them to manage your booking later.
```

## rescheduling a booking

If you need to change the time of your booking:

1. Click the **reschedule link** from your confirmation email or the confirmation page
2. A calendar view appears showing available time slots (similar to the original booking flow)
3. Click on a new available slot
4. Confirm the reschedule

<!-- Reschedule page looks similar to the calendar view in step 2 -->

After rescheduling:
- The original calendar event is removed
- A new calendar event is created at the selected time
- Both you and the calendar owner receive an updated confirmation email
- New reschedule and cancel links are generated (the old links will no longer work)

```{note}
Each time you reschedule, new management links are generated for security. The links from your original booking will stop working.
```

## cancelling a booking

If you need to cancel your booking:

1. Click the **cancel link** from your confirmation email or the confirmation page
2. A cancellation confirmation page appears showing your booking details
3. Click **Confirm Cancellation**

<!-- Cancel page shows booking details with a confirmation button -->

After cancelling:
- The calendar event is removed
- Both you and the calendar owner receive a cancellation notification email
- The booking is marked as cancelled and cannot be rescheduled

## email notifications

CDL Scheduler sends automatic email notifications at each stage:

### confirmation email
- Sent to both the visitor and the calendar owner
- Contains the meeting date, time, duration, location, and purpose
- Includes an **iCal attachment** (.ics file) that can be added to your calendar app
- Contains links to reschedule or cancel the booking

### reschedule notification
- Sent to both parties when a booking is rescheduled
- Contains the new meeting date and time
- Includes an updated iCal attachment
- Contains new reschedule and cancel links

### cancellation notification
- Sent to both parties when a booking is cancelled
- Confirms the cancellation with the original meeting details
