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
    return (
      <div>
        <label for="upload-hashtags">#haghtags</label>
        <textarea id="upload-hashtags" readonly>#barba_gianny #beardlove #barbalunga #barbacurata #barbershop #barberstyle #beardthefuckup #barbermoderno #barberia #beardman #beardmodel grownbeard #beardboy #moustache #moustachelove #moustachelife #moustaches #moustacheboy #beardlifestyle #beardstagram #beardedvillainsitaly</textarea>
      </div>
    );
  }
}
