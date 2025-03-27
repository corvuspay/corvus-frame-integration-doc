"use strict";
const CORVUSPAY_STORE_PUBLIC_KEY = [STORE_PUBLIC_KEY];

/**
 * Session token received from CorvusPay backend during /get-session-token call.
 */
let sessionToken;

document.addEventListener("DOMContentLoaded", (event) => {
    const urlParams = new URLSearchParams(window.location.search);
    document.getElementById("status").innerText = urlParams.get("status");
    document.getElementById("approvalCode").innerText =
        urlParams.get("approvalCode");
    document.getElementById("displayMessage").innerText =
        urlParams.get("displayMessage");

    const token = localStorage.getItem("token");
    const userCardProfileId = localStorage.getItem("userCardProfileId")
    document.getElementById("tokenValue").innerText = token;
    document.getElementById("userCardProfileId").innerText = userCardProfileId;
    getSessionTokenForCardStorage(userCardProfileId, token);
})

const getSessionTokenForCardStorage = (user_card_profile_id, token) => {
    const sessionTokenData = {
        userCardProfileId: user_card_profile_id,
        token: token
    };
    // We are sending the sessionTokenData to the backend which communicates with CorvusPay in order to fetch session
    // token that can be used for initiating payment with token
    fetch("/corvuspay-fetch-session-token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionTokenData),
    })
        .then((response) => {
            if(!response.ok) throw response;
            return response.json()
        })
        .then((data) => {
            if (data.session_token) {
                console.debug(
                    `Session token successfully received. Session token: ${data.session_token}. Validity of session token: ${data.session_token_validity}`
                );
                showPaymentWithTokenForm(data.session_token);
            } else {
                showErrorMessageWithToken(
                    `Error while getting token from backend:<br/> ${JSON.stringify(data)}`
                );
            }
        })
        .catch((error) => {
            console.error(error);
            if (error.json) {
                error
                    .json()
                    .then((responseJson) => showErrorMessageWithToken(responseJson.error));
            } else {
                showErrorMessageWithToken(error.message);
            }
        });
};

const showPaymentWithTokenForm = (sessionToken) => {
    console.log(`Displaying payment form with a session token ${sessionToken}`)
    // We will need the session token when initiating request with token (using a card from card storage). So, for test purposes
    // the session token will be stored as a global variable
    console.log("Storing session token to global variable")
    this.sessionToken = sessionToken;
    
    document.getElementById("corvuspay-payment-with-token-form").style.display = "block";
    // mandatory parameters
    const requiredParameters = {
        publicKey: CORVUSPAY_STORE_PUBLIC_KEY,
    };

    const optionalParameters = {
        installmentsRequired: false,
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

    const cardWithToken = corvuspay.cardWithToken(sessionToken, option, style, "corvuspay-with-token-card-element");

    // This event is fired when the CorvusFrame form is loaded and ready
    cardWithToken.on("ready", () => console.debug(`CorvusPay form is ready 🙂`));
    // This event is fired when card data is entered successfully and is valid
    cardWithToken.on("card-ready", (cardReady) => changeCardWithTokenReadiness(cardReady));
    // This event is fired when a validation error occurs within the CorvusFrame form.
    //e.g. when card number is invalid
    cardWithToken.on("show-error", (errorMsg) =>
        showErrorMessageWithToken(`Validation error: ${errorMsg}`)
    );
    // This event is fired when a previously reported validation error is no longer present in the CorvusFrame form
    cardWithToken.on("clear-error", (errorMsg) => {
        clearErrorMessageWithToken(errorMsg);
    });
    // This event is fired when an error occurs within the CorvusFrame form
    cardWithToken.on("error", (errorMsg) => showErrorMessageWithToken(errorMsg));

    // when user clicks on submit button, we are calling initPaymentWithTokenOnBackend function
    // from card object
    document
        .getElementById("corvuspay-payment-with-token-form")
        .querySelector('input[type="submit"]')
        .addEventListener("click", (e) => {
            e.preventDefault();
            initPaymentWithTokenOnBackend(e, cardWithToken);
        });
};

const initPaymentWithTokenOnBackend = (e, cardWithToken) => {
    renderSpinnerInElement(e.target.parentNode);
    const customer = {
        cardholderAddress: "Buzinski prilaz 10",
        cardholderCity: "Zagreb",
        cardholderZipCode: "10000",
        cardholderCountry: "Croatia",
        cardholderEmail: "test.test@corvuspay.com",
    };
    const purchase = {
        amount: 1.23, // amount in currency unit, not cents
        currency: "EUR", // currency in ISO 4217 format
        cart: "Product 1", // cart description
    };

    const paymentInfo = {
        // customer: JSON.stringify(customer),
        purchase: JSON.stringify(purchase),
        sessionToken: JSON.stringify(this.sessionToken)
    };

    // We are sending paymentInfo to our backend to initiate card storage payment with token (we are using a card from card storage)
    fetch("/corvuspay-init-payment-with-token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentInfo)
    })
        .then((response) => {
            if(!response.ok) throw response;
            return response.json()
        })
        .then((data) => {
            console.debug(`Transaction with token successfully initiated. Payment ID: ${data.payment_id}`)
            //Transaction is initiated, we can start card payment with payment_id we got from backend
            // when payment is finished, doOnFinishCardWithTokenPayment will be called
            cardWithToken.finishCardPayment(
                data.payment_id,
                doOnFinishCardWithTokenPayment
            );
            removeSpinnerInElement(e.target.parentNode);
        })
        .catch((error) => {
            console.error(error);
            if (error.json) {
                error
                    .json()
                    .then((responseJson) => showErrorMessageWithToken(responseJson.error));
            } else {
                showErrorMessageWithToken(error.message);
            }
            removeSpinnerInElement(e.target.parentNode);
        });
}

/**
 * This function is called when card payment with token is finished.
 * @param {{displayMessage: String,
 *          errorCode: String,
 *          paymentId: String,
 *          signature: String,
 *          status: String
 *          approvalCode:String}} cardPaymentWithTokenResult
 */
const doOnFinishCardWithTokenPayment = (cardPaymentWithTokenResult) => {
    console.debug("Card payment with token result: ", cardPaymentWithTokenResult);
    const params = new URLSearchParams({
        displayMessage: cardPaymentWithTokenResult.displayMessage,
        status: cardPaymentWithTokenResult.status,
        errorCode: cardPaymentWithTokenResult.errorCode,
        paymentId: cardPaymentWithTokenResult.paymentId,
        signature: cardPaymentWithTokenResult.signature,
        approvalCode: cardPaymentWithTokenResult.approvalCode,
    }).toString();
    if (cardPaymentWithTokenResult.status === "ok") {
        // transaction was successful. we need to check if signature is valid
        fetch("/corvuspay-check-payment-response", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(cardPaymentWithTokenResult),
        }).then((response) => {
            if (response.ok) {
                console.debug("Signature is valid!");
                window.location.href = `/success.html?${params}`;
            } else {
                showErrorMessageWithToken("Error while checking payment response");
            }
        });
    } else {
        window.location.href = `/error.html?${params}`;
    }
};

const changeCardWithTokenReadiness = (cardReady) => {
    console.debug("Card is ready: ", cardReady ? "Yes" : "No");
    document.querySelector('input[type="submit"]').disabled = !cardReady;
    if (cardReady) {
        document.getElementById("corvuspay-with-token-error").innerHTML = "";
    }
};

const showErrorMessageWithToken = (errorMsg) => {
    document.getElementById("corvuspay-with-token-error").innerHTML = errorMsg;
};

const clearErrorMessageWithToken = (errorMsg) => {
    document.getElementById("corvuspay-with-token-error").innerHTML = "";
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

function goBack() {
    window.location.href = "/";
}
