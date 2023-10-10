"use strict";
const CORVUSPAY_STORE_PUBLIC_KEY = [STORE_PUBLIC_KEY];

document.addEventListener("DOMContentLoaded", (event) => {
  // mandatory parameters
  const requiredParameters = {
    publicKey: CORVUSPAY_STORE_PUBLIC_KEY,
  };

  const optionalParameters = {
    installmentsRequired: true,
  };

  // Initialize CorvusPay with your public key and options
  const corvuspay = CorvusPay.init(requiredParameters, optionalParameters);

  const option = {
    showCvv: true, // Set to true if you want to show cvv field
    hideCorvusPayLogo: false, // Set to true if you want to hide the logo
  };

  /**
   * We can customize the look of the CorvusPay form by passing style object
   * backgroundColor: Background color of the form
   * fontFamily: Font family of the form
   * fontSize: Font size of the form
   */
  const style = {
    // backgroundColor: "#ffffff", // Background color of the form
    // fontFamily: "Arial", // Font family of the form
    // fontSize: 13, // Font size of the form
  };

  const card = corvuspay.card(option, style, "corvuspay-card-element");

  // This event is fired when the CorvusFrame form is loaded and ready
  card.on("ready", () => console.debug(`CorvusPay form is ready 🙂`));
  // This event is fired when card data is entered successfully and is valid
  card.on("card-ready", (cardReady) => changeCardReadiness(cardReady));
  // This event is fired when a validation error occurs within the CorvusFrame form.
  //e.g. when card number is invalid
  card.on("show-error", (errorMsg) =>
    showErrorMessage(`Validation error: ${errorMsg}`)
  );
  // This event is fired when an error occurs within the CorvusFrame form
  card.on("error", (errorMsg) => showErrorMessage(errorMsg));

  // when user clicks on submit button, we are calling initPaymentOnBackend function
  // from card object
  document
    .getElementById("corvuspay-payment-form")
    .querySelector('input[type="submit"]')
    .addEventListener("click", (e) => {
      e.preventDefault();
      initPaymentOnBackend(e, card);
    });
});

const initPaymentOnBackend = (e, card) => {
  renderSpinnerInElement(e.target.parentNode);
  const customer = {
    cardholderName: "Test",
    cardholderSurname: "Test",
    cardholderAddress: "Buzinski prilaz 10",
    cardholderCity: "Zagreb",
    cardholderZipCode: "10000",
    cardholderCountry: "Croatia",
    cardholderEmail: "test.test@corvuspay.com",
  };

  /**
   * Example of purchase object
   *
   */
  const purchase = {
    amount: 1.23, // amount in currency unit, not cents
    currency: "EUR", // currency in ISO 4217 format
    cart: "Product 1", // cart description
  };

  const paymentInfo = {
    customer: JSON.stringify(customer),
    purchase: JSON.stringify(purchase),
  };

  // We are sending paymentInfo to our backend
  fetch("/corvuspay-init-payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(paymentInfo),
  })
    .then((response) => {
      if (!response.ok) throw response;
      return response.json();
    })
    .then((data) => {
      console.debug(
        `Transaction successfully initialized. Payment ID: ${data.payment_id}`
      );
      // Transaction is initialized, we can start card payment with payment_id we got from backend
      // when payment is finished, doOnFinishCardPayment will be called
      card.finishCardPayment(data.payment_id, doOnFinishCardPayment);
      removeSpinnerInElement(e.target.parentNode);
    })
    .catch((error) => {
      console.error(error);
      if (error.json) {
        error
          .json()
          .then((responseJson) => showErrorMessage(responseJson.error));
      } else {
        showErrorMessage(error.message);
      }
      removeSpinnerInElement(e.target.parentNode);
    });
};

const showErrorMessage = (errorMsg) => {
  document.getElementById("corvuspay-error").innerHTML = errorMsg;
};

const changeCardReadiness = (cardReady) => {
  console.debug("Card is ready: ", cardReady ? "Yes" : "No");
  document.querySelector('input[type="submit"]').disabled = !cardReady;
  if (cardReady) {
    document.getElementById("corvuspay-error").innerHTML = "";
  }
};

/**
 * This function is called when card payment is finished.
 * @param {{displayMessage: String,
 *          errorCode: String,
 *          paymentId: String,
 *          signature: String,
 *          status: String
 *          approvalCode:String}} cardPaymentResult
 */
const doOnFinishCardPayment = (cardPaymentResult) => {
  console.debug("Card payment result: ", cardPaymentResult);

  const params = new URLSearchParams({
    displayMessage: cardPaymentResult.displayMessage,
    status: cardPaymentResult.status,
    errorCode: cardPaymentResult.errorCode,
    paymentId: cardPaymentResult.paymentId,
    signature: cardPaymentResult.signature,
    approvalCode: cardPaymentResult.approvalCode,
  }).toString();

  if (cardPaymentResult.status === "ok") {
    // transaction was successful. we need to check if signature is valid
    fetch("/corvuspay-check-payment-response", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cardPaymentResult),
    }).then((response) => {
      if (response.ok) {
        console.debug("Signature is valid!");
        window.location.href = `/success.html?${params}`;
      } else {
        showErrorMessage("Error while checking payment response");
      }
    });
  } else {
    window.location.href = `/error.html?${params}`;
  }
};

const renderSpinnerInElement = (element) => {
  const markup = /*html*/ `
    <div class="spinner-auto">
      <svg>
        <use href="/img/icons.svg#icon-loader"></use>
      </svg>
    </div>
  `;

  element.insertAdjacentHTML("afterbegin", markup);
};

const removeSpinnerInElement = (element) => {
  element.querySelector(".spinner-auto").remove();
};
