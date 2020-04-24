$('.chat[data-chat=person2]').addClass('active-chat');
$('.person[data-chat=person2]').addClass('active');

$('.left .person').mousedown(function(){
    if ($(this).hasClass('.active')) {
        return false;
    } else {
        var findChat = $(this).attr('data-chat');
        var personName = $(this).find('.name').text();
        $('.right .top .name').html(personName);
        $('.chat').removeClass('active-chat');
        $('.left .person').removeClass('active');
        $(this).addClass('active');
        $('.chat[data-chat = '+findChat+']').addClass('active-chat');
    }
});


var ConversationPanel = (function () {

    return {
      init: init,
      inputKeyDown: inputKeyDown,
      getlang: getlang,
      sendMessage: sendMessage,
      scrollToChatBottom: scrollToChatBottom
    };
  
    // Initialize the module
    function init() {
      Api.getSessionId(function() {
        Api.sendRequest('', 'en');
      });
    }
 
    // Scroll to the bottom of the chat window
    function scrollToChatBottom() {
      var scrollingChat = document.querySelector('.chat.active-chat');
      scrollingChat.scrollTop = scrollingChat.scrollHeight;
    }
  
    function sendMessage(text) {
      // Send the user message
      Api.sendRequest(text);
    }
  
    // Handles the submission of input
    function inputKeyDown(event, inputBox) {
      if (event.keyCode === 13 && inputBox.value) {
        alert(inputBox.value);
        $('.chat').append('<div class="bubble me">' + inputBox.value + '</div>');
        sendMessage(inputBox.value, "en");
        inputBox.value = ''; 
        }
    }
  
    function getlang() {
      var x = document.getElementById("mySelect").selectedIndex;
       Api.sendRequest("Language has changed to "+document.getElementsByTagName("option")[x].text, document.getElementsByTagName("option")[x].value);
      return document.getElementsByTagName("option")[x].value;
    }




  }());
  