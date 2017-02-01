import { h, Component } from 'preact';


export default class HashtagsComponent extends Component {
  
  constructor(props) {
    super(props);
    this.state = { done: false };
  }

  _handleChange( e ) {
    var text = e.target.value;
    this.props.onChange( {caption: text} );
  }

  render() {

    let hashtags = [
      '#barba_gianny',
      '#beardlove',
      '#barbalunga',
      '#barbacurata',
      '#barbershop',
      '#barberstyle',
      '#beardthefuckup',
      '#barbermoderno',
      '#barberia',
      '#beardman',
      '#beardmodel',
      '#grownbeard',
      '#beardlifestyle',
      '#beardstagram',
      '#beardedvillainsitaly',
      '#lebarbeignoranti',
      '#barbutoitaliano',
      '#beardinspire',
      '#barba'
    ];

    return (
      <div>
        <label for="upload-hashtags">#haghtags ({hashtags.length})</label>
        <textarea id="upload-hashtags" readonly>
          { hashtags.join(' ') }
        </textarea>
      </div>
    );
  }
}
